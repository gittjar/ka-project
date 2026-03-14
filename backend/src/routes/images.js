import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import exifrPkg from 'exifr';
const { parse: parseExif } = exifrPkg;
import { BlobServiceClient } from '@azure/storage-blob';
import authMiddleware from '../middleware/auth.js';
import GalleryImage from '../models/GalleryImage.js';

const router = express.Router();
// Hyväksytään kaikki yleisimmät kuvaformaatit (MIME tai tiedostopääte)
const ACCEPTED_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|svg|ico)$/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || ACCEPTED_EXT.test(file.originalname);
    cb(null, ok);
  },
});

// Selainyhteensopimattomat formaatit → konvertoidaan JPEG:iin
const HEIC_EXT = /\.(heic|heif)$/i;
const SHARP_CONVERT = /\.(tiff?|bmp|avif)$/i;

async function toWebBuffer(file) {
  const name = file.originalname;
  const mime = file.mimetype || '';
  if (HEIC_EXT.test(name) || mime === 'image/heic' || mime === 'image/heif') {
    const outputBuffer = await heicConvert({ buffer: file.buffer, format: 'JPEG', quality: 0.88 });
    return { buffer: Buffer.from(outputBuffer), mimetype: 'image/jpeg', ext: 'jpg' };
  }
  if (SHARP_CONVERT.test(name) || ['image/tiff','image/bmp','image/avif'].includes(mime)) {
    const buffer = await sharp(file.buffer).jpeg({ quality: 88 }).toBuffer();
    return { buffer, mimetype: 'image/jpeg', ext: 'jpg' };
  }
  const ext = name.split('.').pop()?.toLowerCase() || 'bin';
  return { buffer: file.buffer, mimetype: mime || 'application/octet-stream', ext };
}

// Lue EXIF-metatiedot alkuperäisestä bufferista (ennen konvertointia)
async function extractExif(buffer) {
  try {
    const raw = await parseExif(buffer, {
      tiff: true, exif: true, gps: true, ifd1: false,
      pick: [
        'DateTimeOriginal','CreateDate',
        'Make','Model','LensModel','Software',
        'FNumber','ExposureTime','ISO','FocalLength','FocalLengthIn35mmFormat',
        'Flash','WhiteBalance',
        'ImageWidth','ImageHeight','ExifImageWidth','ExifImageHeight',
        'Orientation',
        'latitude','longitude','GPSAltitude',
        'GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef',
      ],
    });
    if (!raw) return {};

    const exifData = {};
    const taken = raw.DateTimeOriginal || raw.CreateDate;
    if (taken) exifData.dateTaken = taken;
    if (raw.Make)       exifData.make = raw.Make;
    if (raw.Model)      exifData.model = raw.Model;
    if (raw.LensModel)  exifData.lens = raw.LensModel;
    if (raw.Software)   exifData.software = raw.Software;
    if (raw.FNumber)    exifData.fNumber = raw.FNumber;
    if (raw.ExposureTime) {
      // Muutetaan desimaali murtoluvuksi esim. 0.00833 → "1/120"
      const et = raw.ExposureTime;
      exifData.exposureTime = et < 1 ? `1/${Math.round(1/et)}` : `${et}s`;
    }
    if (raw.ISO)           exifData.iso = raw.ISO;
    if (raw.FocalLength)   exifData.focalLength = raw.FocalLength;
    if (raw.FocalLengthIn35mmFormat) exifData.focalLength35 = raw.FocalLengthIn35mmFormat;
    if (raw.Flash !== undefined) exifData.flash = String(raw.Flash);
    if (raw.WhiteBalance !== undefined) exifData.whiteBalance = String(raw.WhiteBalance);
    const w = raw.ExifImageWidth  || raw.ImageWidth;
    const h = raw.ExifImageHeight || raw.ImageHeight;
    if (w) exifData.width = w;
    if (h) exifData.height = h;
    if (raw.Orientation !== undefined) exifData.orientation = String(raw.Orientation);
    if (raw.latitude)    exifData.latitude = raw.latitude;
    else if (raw.GPSLatitude && raw.GPSLatitudeRef) {
      const [d,m,s] = raw.GPSLatitude;
      exifData.latitude = (d + m/60 + s/3600) * (raw.GPSLatitudeRef === 'S' ? -1 : 1);
    }
    if (raw.longitude)   exifData.longitude = raw.longitude;
    else if (raw.GPSLongitude && raw.GPSLongitudeRef) {
      const [d,m,s] = raw.GPSLongitude;
      exifData.longitude = (d + m/60 + s/3600) * (raw.GPSLongitudeRef === 'W' ? -1 : 1);
    }
    if (raw.GPSAltitude) exifData.altitude = raw.GPSAltitude;
    return exifData;
  } catch {
    return {};
  }
}

function getBlobClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING puuttuu');
  return BlobServiceClient.fromConnectionString(connStr);
}

// GET /api/images?container=gallery  — julkinen, palauttaa Mongosta metatiedoilla
router.get('/', async (req, res) => {
  try {
    const container = req.query.container || 'gallery';
    if (container === 'gallery') {
      const images = await GalleryImage.find({}).sort({ createdAt: -1 });
      return res.json(images);
    }
    // Muut containerit (avatars): haetaan suoraan blobista
    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(container);
    const exists = await containerClient.exists();
    if (!exists) return res.json([]);
    const items = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const blockBlob = containerClient.getBlockBlobClient(blob.name);
      items.push({ blobName: blob.name, url: blockBlob.url, createdAt: blob.properties.createdOn });
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Listaus epäonnistui', error: err.message });
  }
});

// POST /api/images/upload
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  console.log('[upload] role:', req.role, '| file:', req.file?.originalname, '| container:', req.query.container);
  try {
    if (!req.file) return res.status(400).json({ message: 'Tiedosto puuttuu' });
    const container = req.query.container || 'gallery';
    if (container === 'gallery' && req.role !== 'admin') {
      return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    }

    // Lue EXIF alkuperäisestä bufferista ennen konvertointia
    const exifData = await extractExif(req.file.buffer);

    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(container);
    await containerClient.createIfNotExists({ access: 'blob' });

    const { buffer, mimetype, ext } = await toWebBuffer(req.file).catch(err => {
      throw new Error('Kuvan konvertointi epäonnistui: ' + err.message);
    });

    // Jos alkuperäisessä ei ollut EXIFiä, koetetaan konvertoinnin jälkeisestä
    const finalExif = Object.keys(exifData).length ? exifData : await extractExif(buffer);
    console.log('[upload] exif keys:', Object.keys(finalExif));
    const blobName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blockBlob = containerClient.getBlockBlobClient(blobName);
    await blockBlob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype } });

    // Tallenna Mongoon (vain gallery)
    let doc = { blobName, url: blockBlob.url, uploadedBy: req.username };
    if (container === 'gallery') {
      if (Object.keys(finalExif).length) doc.exif = finalExif;
      const saved = await GalleryImage.create(doc);
      return res.json(saved);
    }
    res.json({ url: blockBlob.url, blobName });
  } catch (err) {
    console.error('[upload] ERROR:', err.message, err.stack?.split('\n')[1]);
    res.status(500).json({ message: 'Lataus epäonnistui', error: err.message });
  }
});

// DELETE /api/images/:container/:blobName
router.delete('/:container/:blobName', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(req.params.container);
    await containerClient.deleteBlob(req.params.blobName);
    if (req.params.container === 'gallery') {
      await GalleryImage.deleteOne({ blobName: req.params.blobName });
    }
    res.json({ message: 'Kuva poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui', error: err.message });
  }
});

export default router;
