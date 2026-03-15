import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import exifrPkg from 'exifr';
const { parse: parseExif } = exifrPkg;
import { BlobServiceClient } from '@azure/storage-blob';
import authMiddleware from '../middleware/auth.js';
import GalleryImage from '../models/GalleryImage.js';
import Folder from '../models/Folder.js';

const router = express.Router();
const CONTAINER = 'gallery';
const MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

const ACCEPTED_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|svg|mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
const VIDEO_EXT    = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
const HEIC_EXT     = /\.(heic|heif)$/i;
const SHARP_CONV   = /\.(tiff?|bmp|avif)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') ||
               file.mimetype.startsWith('video/') ||
               ACCEPTED_EXT.test(file.originalname);
    cb(null, ok);
  },
});

function isVideo(file) {
  return file.mimetype.startsWith('video/') || VIDEO_EXT.test(file.originalname);
}

async function processImageBuffer(file) {
  const name = file.originalname;
  const mime = file.mimetype || '';
  if (HEIC_EXT.test(name) || mime === 'image/heic' || mime === 'image/heif') {
    const out = await heicConvert({ buffer: file.buffer, format: 'JPEG', quality: 0.88 });
    return { buffer: Buffer.from(out), mimetype: 'image/jpeg', ext: 'jpg' };
  }
  if (SHARP_CONV.test(name) || ['image/tiff', 'image/bmp', 'image/avif'].includes(mime)) {
    const buffer = await sharp(file.buffer).jpeg({ quality: 88 }).toBuffer();
    return { buffer, mimetype: 'image/jpeg', ext: 'jpg' };
  }
  const ext = name.split('.').pop()?.toLowerCase() || 'bin';
  return { buffer: file.buffer, mimetype: mime || 'application/octet-stream', ext };
}

async function extractExif(buffer) {
  try {
    const raw = await parseExif(buffer, {
      tiff: true, exif: true, gps: true, ifd1: false,
      pick: [
        'DateTimeOriginal', 'CreateDate',
        'Make', 'Model', 'LensModel', 'Software',
        'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat',
        'Flash', 'WhiteBalance',
        'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight',
        'Orientation',
        'latitude', 'longitude', 'GPSAltitude',
        'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef',
      ],
    });
    if (!raw) return {};
    const d = {};
    const taken = raw.DateTimeOriginal || raw.CreateDate;
    if (taken) d.dateTaken = taken;
    if (raw.Make)    d.make     = raw.Make;
    if (raw.Model)   d.model    = raw.Model;
    if (raw.LensModel)  d.lens     = raw.LensModel;
    if (raw.Software)   d.software = raw.Software;
    if (raw.FNumber)    d.fNumber  = raw.FNumber;
    if (raw.ExposureTime) {
      const et = raw.ExposureTime;
      d.exposureTime = et < 1 ? `1/${Math.round(1 / et)}` : `${et}s`;
    }
    if (raw.ISO)           d.iso          = raw.ISO;
    if (raw.FocalLength)   d.focalLength  = raw.FocalLength;
    if (raw.FocalLengthIn35mmFormat) d.focalLength35 = raw.FocalLengthIn35mmFormat;
    if (raw.Flash !== undefined)        d.flash        = String(raw.Flash);
    if (raw.WhiteBalance !== undefined) d.whiteBalance = String(raw.WhiteBalance);
    const w = raw.ExifImageWidth  || raw.ImageWidth;
    const h = raw.ExifImageHeight || raw.ImageHeight;
    if (w) d.width  = w;
    if (h) d.height = h;
    if (raw.Orientation !== undefined) d.orientation = String(raw.Orientation);
    if (raw.latitude)  d.latitude  = raw.latitude;
    else if (raw.GPSLatitude && raw.GPSLatitudeRef) {
      const [deg, min, sec] = raw.GPSLatitude;
      d.latitude = (deg + min / 60 + sec / 3600) * (raw.GPSLatitudeRef === 'S' ? -1 : 1);
    }
    if (raw.longitude) d.longitude = raw.longitude;
    else if (raw.GPSLongitude && raw.GPSLongitudeRef) {
      const [deg, min, sec] = raw.GPSLongitude;
      d.longitude = (deg + min / 60 + sec / 3600) * (raw.GPSLongitudeRef === 'W' ? -1 : 1);
    }
    if (raw.GPSAltitude) d.altitude = raw.GPSAltitude;
    return d;
  } catch {
    return {};
  }
}

function getBlobClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING puuttuu');
  return BlobServiceClient.fromConnectionString(connStr);
}

const toFolderId = (q) => (!q || q === 'null') ? null : q;

// â”€â”€ KANSIOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/images/folders?parent=null|id  â€” julkinen
router.get('/folders', async (req, res) => {
  try {
    const parent = toFolderId(req.query.parent);
    const folders = await Folder.find({ parent }).sort({ name: 1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: 'Kansioiden haku epÃ¤onnistui', error: err.message });
  }
});

// POST /api/images/folders  â€” vain admin
router.post('/folders', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { name, parent } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Kansion nimi vaaditaan' });
    const folder = await Folder.create({ name: name.trim(), parent: parent || null, createdBy: req.username });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Kansion luonti epÃ¤onnistui', error: err.message });
  }
});

// DELETE /api/images/folders/:id  â€” rekursiivinen poisto, vain admin
router.delete('/folders/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    async function collectIds(folderId) {
      const ids = [folderId];
      const subs = await Folder.find({ parent: folderId });
      for (const sub of subs) ids.push(...(await collectIds(sub._id.toString())));
      return ids;
    }
    const allIds = await collectIds(req.params.id);
    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(CONTAINER);
    for (const fid of allIds) {
      const items = await GalleryImage.find({ folderId: fid });
      for (const item of items) {
        try { await containerClient.deleteBlob(item.blobName); } catch { /* ei haittaa */ }
      }
      await GalleryImage.deleteMany({ folderId: fid });
    }
    await Folder.deleteMany({ _id: { $in: allIds } });
    res.json({ message: 'Kansio poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epÃ¤onnistui', error: err.message });
  }
});

// â”€â”€ TALLENNUSTILA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/images/storage  â€” vain admin
router.get('/storage', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const result = await GalleryImage.aggregate([{ $group: { _id: null, total: { $sum: '$fileSize' } } }]);
    res.json({ used: result[0]?.total || 0, max: MAX_BYTES });
  } catch (err) {
    res.status(500).json({ message: 'Tilakysely epÃ¤onnistui', error: err.message });
  }
});

// â”€â”€ MEDIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/images?folder=null|id  â€” julkinen
router.get('/', async (req, res) => {
  try {
    const folderId = toFolderId(req.query.folder);
    const items = await GalleryImage.find({ folderId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Haku epÃ¤onnistui', error: err.message });
  }
});

// POST /api/images/upload?folder=null|id  â€” kirjautunut kÃ¤yttÃ¤jÃ¤
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Tiedosto puuttuu' });
    const folderId = toFolderId(req.query.folder);
    if (folderId) {
      const folder = await Folder.findById(folderId);
      if (!folder) return res.status(404).json({ message: 'Kansiota ei lÃ¶ydy' });
    }

    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(CONTAINER);
    await containerClient.createIfNotExists({ access: 'blob' });

    let buffer, mimetype, ext, mediaType, exifData = {};

    if (isVideo(req.file)) {
      buffer    = req.file.buffer;
      mimetype  = req.file.mimetype || 'video/mp4';
      ext       = req.file.originalname.split('.').pop()?.toLowerCase() || 'mp4';
      mediaType = 'video';
    } else {
      exifData = await extractExif(req.file.buffer);
      const processed = await processImageBuffer(req.file).catch(err => {
        throw new Error('Kuvan konvertointi epÃ¤onnistui: ' + err.message);
      });
      buffer    = processed.buffer;
      mimetype  = processed.mimetype;
      ext       = processed.ext;
      mediaType = 'image';
      if (!Object.keys(exifData).length) exifData = await extractExif(buffer);
    }

    const blobName  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blockBlob = containerClient.getBlockBlobClient(blobName);
    await blockBlob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype } });

    const doc = { blobName, url: blockBlob.url, uploadedBy: req.username, folderId, mediaType, fileSize: buffer.length };
    if (mediaType === 'image' && Object.keys(exifData).length) doc.exif = exifData;

    const saved = await GalleryImage.create(doc);
    res.json(saved);
  } catch (err) {
    console.error('[upload] ERROR:', err.message);
    res.status(500).json({ message: 'Lataus epÃ¤onnistui', error: err.message });
  }
});

// DELETE /api/images/media/:id  â€” oma tai admin
router.delete('/media/:id', authMiddleware, async (req, res) => {
  try {
    const item = await GalleryImage.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Tiedostoa ei lÃ¶ydy' });
    if (req.role !== 'admin' && item.uploadedBy !== req.username) {
      return res.status(403).json({ message: 'Ei oikeutta poistaa tÃ¤tÃ¤ tiedostoa' });
    }
    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(CONTAINER);
    try { await containerClient.deleteBlob(item.blobName); } catch { /* ei haittaa */ }
    await item.deleteOne();
    res.json({ message: 'Tiedosto poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epÃ¤onnistui', error: err.message });
  }
});

export default router;
