import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import exifrPkg from 'exifr';
const { parse: parseExif } = exifrPkg;
import { BlobServiceClient } from '@azure/storage-blob';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegStatic from 'ffmpeg-static';
import Ffmpeg from 'fluent-ffmpeg';
Ffmpeg.setFfmpegPath(ffmpegStatic);
import { randomUUID } from 'crypto';
import authMiddleware from '../middleware/auth.js';
import GalleryImage from '../models/GalleryImage.js';
import Folder from '../models/Folder.js';
import ShareToken from '../models/ShareToken.js';

const router = express.Router();
const CONTAINER = 'gallery';
const MAX_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB

const ACCEPTED_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
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

// Siirtää moov-atomin MP4/MOV-tiedoston alkuun (web-streaming optimointi)
async function applyFaststart(inputBuffer) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpIn  = join(tmpdir(), `ff-in-${id}.mp4`);
  const tmpOut = join(tmpdir(), `ff-out-${id}.mp4`);
  try {
    await writeFile(tmpIn, inputBuffer);
    await new Promise((resolve, reject) => {
      Ffmpeg(tmpIn)
        .outputOptions(['-movflags +faststart', '-c copy'])
        .save(tmpOut)
        .on('end', resolve)
        .on('error', reject);
    });
    return await readFile(tmpOut);
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

const toFolderId = (q) => (!q || q === 'null') ? null : q;

// â”€â”€ KANSIOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/images/folders?parent=null|id  — kirjautunut käyttäjä
// Palauttaa kansiot rikastettuna tilastoilla: imageCount, videoCount, totalViews, previewUrl
router.get('/folders', authMiddleware, async (req, res) => {
  try {
    const parent = toFolderId(req.query.parent);
    const folders = await Folder.find({ parent }).sort({ name: 1 }).lean();
    if (folders.length === 0) return res.json([]);

    const folderIds = folders.map(f => f._id);
    const stats = await GalleryImage.aggregate([
      { $match: { folderId: { $in: folderIds } } },
      { $group: {
        _id: '$folderId',
        imageCount: { $sum: { $cond: [{ $eq: ['$mediaType', 'image'] }, 1, 0] } },
        videoCount: { $sum: { $cond: [{ $eq: ['$mediaType', 'video'] }, 1, 0] } },
        totalViews: { $sum: { $ifNull: ['$viewCount', 0] } },
        previewBlobNames: { $push: { $cond: [{ $eq: ['$mediaType', 'image'] }, '$blobName', null] } },
      }},
    ]);

    const statsMap = {};
    for (const s of stats) {
      const blobNames = s.previewBlobNames.filter(Boolean);
      const previewBlobName = blobNames.length ? blobNames[Math.floor(Math.random() * Math.min(blobNames.length, 5))] : null;
      statsMap[s._id.toString()] = {
        imageCount: s.imageCount,
        videoCount: s.videoCount,
        totalViews: s.totalViews,
        previewBlobName,
      };
    }

    const result = folders.map(f => ({
      ...f,
      ...(statsMap[f._id.toString()] || { imageCount: 0, videoCount: 0, totalViews: 0, previewUrl: null }),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Kansioiden haku epäonnistui' });
  }
});

// POST /api/images/folders  â€” vain admin
// GET /api/images/folders/:id  — yksittäinen kansio ID:llä (syvälinkitystä varten)
router.get('/folders/:id', authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id).lean();
    if (!folder) return res.status(404).json({ message: 'Kansiota ei löydy' });
    res.json(folder);
  } catch {
    res.status(500).json({ message: 'Kansion haku epäonnistui' });
  }
});

router.post('/folders', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { name, parent } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Kansion nimi vaaditaan' });
    const folder = await Folder.create({ name: name.trim(), parent: parent || null, createdBy: req.username });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Kansion luonti epÃ¤onnistui' });
  }
});

// PATCH /api/images/folders/:id  – uudelleennimeäminen tai kuvaus, vain admin
router.patch('/folders/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const updates = {};
    const { name, description } = req.body;
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Kansion nimi ei voi olla tyhjä' });
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = String(description).slice(0, 2000);
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Ei muutoksia' });
    const folder = await Folder.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!folder) return res.status(404).json({ message: 'Kansiota ei löydy' });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui' });
  }
});

// DELETE /api/images/folders/:id  – rekursiivinen poisto, vain admin
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
    res.status(500).json({ message: 'Poisto epÃ¤onnistui' });
  }
});

// â”€â”€ TALLENNUSTILA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/images/storage  — vain admin
router.get('/storage', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const result = await GalleryImage.aggregate([{ $group: { _id: null, total: { $sum: '$fileSize' } } }]);
    res.json({ used: result[0]?.total || 0, max: MAX_BYTES });
  } catch (err) {
    res.status(500).json({ message: 'Tilakysely epäonnistui' });
  }
});

// GET /api/images/storage/public  — julkinen, palauttaa kokonaiskoko + mediamäärät
router.get('/storage/public', async (_req, res) => {
  try {
    const [sizeResult, imageCount, videoCount] = await Promise.all([
      GalleryImage.aggregate([{ $group: { _id: null, total: { $sum: '$fileSize' } } }]),
      GalleryImage.countDocuments({ mediaType: 'image' }),
      GalleryImage.countDocuments({ mediaType: 'video' }),
    ]);
    res.json({ used: sizeResult[0]?.total || 0, imageCount, videoCount });
  } catch (err) {
    res.status(500).json({ message: 'Tilakysely epäonnistui' });
  }
});

// â”€â”€ MEDIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/images?folder=null|id  — kirjautunut käyttäjä
router.get('/', authMiddleware, async (req, res) => {
  try {
    const folderId = toFolderId(req.query.folder);
    const items = await GalleryImage.find({ folderId }).sort({ sortOrder: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Haku epÃ¤onnistui' });
  }
});

// POST /api/images/upload?folder=null|id  — kirjautunut käyttäjä
// POST /api/images/upload?container=avatars — profiilikuva, ei tallenneta galleriaan
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Tiedosto puuttuu' });

    // Avatar-upload: eri container, ei GalleryImage-dokumenttia
    if (req.query.container === 'avatars') {
      const blobService = getBlobClient();
      const containerClient = blobService.getContainerClient('avatars');
      await containerClient.createIfNotExists({ access: 'blob' }); // julkinen luku avatareille
      const processed = await processImageBuffer(req.file).catch(err => {
        throw new Error('Kuvan konvertointi epäonnistui: ' + err.message);
      });
      const blobName  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${processed.ext}`;
      const blockBlob = containerClient.getBlockBlobClient(blobName);
      await blockBlob.uploadData(processed.buffer, { blobHTTPHeaders: { blobContentType: processed.mimetype } });
      return res.json({ url: blockBlob.url });
    }

    const folderId = toFolderId(req.query.folder);
    if (folderId) {
      const folder = await Folder.findById(folderId);
      if (!folder) return res.status(404).json({ message: 'Kansiota ei löydy' });
    }

    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(CONTAINER);
    await containerClient.createIfNotExists(); // yksityinen — ei julkista pääsyä

    let buffer, mimetype, ext, mediaType, exifData = {};

    if (isVideo(req.file)) {
      const raw = req.file.buffer;
      ext       = req.file.originalname.split('.').pop()?.toLowerCase() || 'mp4';
      mimetype  = req.file.mimetype || 'video/mp4';
      mediaType = 'video';
      // Siirrä moov-atomi tiedoston alkuun jotta selain voi aloittaa toiston heti
      buffer = await applyFaststart(raw).catch(() => raw); // fallback alkuperäiseen jos ffmpeg epäonnistuu
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
    res.status(500).json({ message: 'Lataus epÃ¤onnistui' });
  }
});

// PATCH /api/images/media/:id  — päivitä caption (oma/admin) tai sortOrder/folderId (admin)
router.patch('/media/:id', authMiddleware, async (req, res) => {
  try {
    const item = await GalleryImage.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Tiedostoa ei löydy' });
    const isOwner = item.uploadedBy === req.username;
    const isAdmin = req.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Ei oikeutta' });
    if (req.body.caption !== undefined) item.caption = String(req.body.caption).slice(0, 500);
    if (isAdmin) {
      if (req.body.sortOrder !== undefined) item.sortOrder = Number(req.body.sortOrder);
      if ('folderId' in req.body) item.folderId = req.body.folderId || null;
    }
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui' });
  }
});

// PATCH /api/images/reorder  — admin, tallenna järjestys [{id, sortOrder}]
router.patch('/reorder', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const updates = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ message: 'Array vaaditaan' });
    await Promise.all(updates.map(({ id, sortOrder }) =>
      GalleryImage.findByIdAndUpdate(id, { sortOrder })
    ));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Järjestyksen tallennus epäonnistui' });
  }
});

// GET /api/images/carousel  — julkinen, palauttaa max 5 carouselkuvaa
router.get('/carousel', async (_req, res) => {
  try {
    const items = await GalleryImage.find({ carouselOrder: { $ne: null } })
      .sort({ carouselOrder: 1 })
      .limit(5)
      .select('url blobName mediaType caption exif.dateTaken carouselOrder');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui' });
  }
});

// PUT /api/images/carousel  — admin, asettaa max 5 kuvaa carouseliin [{id}] järjestyksessä
router.put('/carousel', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const ids = req.body;
    if (!Array.isArray(ids) || ids.length > 5) {
      return res.status(400).json({ message: 'Lähetä taulukko max 5 id:llä' });
    }
    // Tyhjennä kaikki ensin
    await GalleryImage.updateMany({ carouselOrder: { $ne: null } }, { carouselOrder: null });
    // Aseta uudet
    await Promise.all(ids.map((id, i) =>
      GalleryImage.findByIdAndUpdate(id, { carouselOrder: i })
    ));
    const items = await GalleryImage.find({ carouselOrder: { $ne: null } })
      .sort({ carouselOrder: 1 })
      .limit(5)
      .select('url blobName mediaType caption exif.dateTaken carouselOrder');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Tallennus epäonnistui' });
  }
});

// POST /api/images/media/:id/view  — kirjautunut käyttäjä, lisää katselukerran
router.post('/media/:id/view', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const item = await GalleryImage.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { viewCount: 1 },
        $push: { openedAt: { $each: [now], $slice: -5 } },
      },
      { new: true, select: 'viewCount openedAt' }
    );
    if (!item) return res.status(404).json({ message: 'Kuvaa ei löydy' });
    res.json({ viewCount: item.viewCount, openedAt: item.openedAt });
  } catch (err) {
    res.status(500).json({ message: 'Virhe' });
  }
});

// DELETE /api/images/media/:id  — oma tai admin
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
    res.status(500).json({ message: 'Poisto epÃ¤onnistui' });
  }
});
// ── Jakolinkit ────────────────────────────────────────────────────────────────

// POST /api/images/share  — luo jaettava linkki yhdelle kuvalle (auth vaaditaan)
router.post('/share', authMiddleware, async (req, res) => {
  try {
    const { blobName, folderId } = req.body;
    if (!blobName) return res.status(400).json({ message: 'blobName vaaditaan' });
    const image = await GalleryImage.findOne({ blobName }).select('_id');
    if (!image) return res.status(404).json({ message: 'Kuvaa ei löydy' });
    // Palauta olemassaoleva token jos kuvalla on jo sellainen
    let share = await ShareToken.findOne({ blobName });
    if (!share) {
      share = await ShareToken.create({
        token: randomUUID(),
        blobName,
        folderId: folderId || null,
        createdBy: req.username,
      });
    }
    res.json({ token: share.token });
  } catch {
    res.status(500).json({ message: 'Jakolinkin luonti epäonnistui' });
  }
});

// GET /api/images/share/:token  — hae jaetun kuvan tiedot (julkinen, token on salaisuus)
router.get('/share/:token', async (req, res) => {
  try {
    const share = await ShareToken.findOne({ token: req.params.token });
    if (!share) return res.status(404).json({ message: 'Jakolinkkiä ei löydy' });
    res.json({ blobName: share.blobName, folderId: share.folderId ?? null });
  } catch {
    res.status(500).json({ message: 'Virhe' });
  }
});

// GET /api/images/shares  — admin: listaa kaikki jakolinkit tilastoineen
router.get('/shares', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const shares = await ShareToken.find().sort({ createdAt: -1 }).lean();
    // Rikasta kuvan kansionimi + mediaType
    const blobNames = shares.map(s => s.blobName);
    const images = await GalleryImage.find({ blobName: { $in: blobNames } })
      .select('blobName mediaType folderId').lean();
    const imgMap = Object.fromEntries(images.map(i => [i.blobName, i]));
    const folderIds = [...new Set(shares.map(s => s.folderId).filter(Boolean))];
    const folders = folderIds.length
      ? await (await import('../models/Folder.js')).default.find({ _id: { $in: folderIds } }).select('name').lean()
      : [];
    const folderMap = Object.fromEntries(folders.map(f => [f._id.toString(), f.name]));
    res.json(shares.map(s => ({
      ...s,
      mediaType: imgMap[s.blobName]?.mediaType ?? 'image',
      folderName: s.folderId ? (folderMap[s.folderId.toString()] ?? null) : null,
    })));
  } catch {
    res.status(500).json({ message: 'Virhe' });
  }
});

// DELETE /api/images/shares/:id  — admin: poista jakolinkki
router.delete('/shares/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    await ShareToken.findByIdAndDelete(req.params.id);
    res.json({ message: 'Jakolinkki poistettu' });
  } catch {
    res.status(500).json({ message: 'Virhe' });
  }
});

export default router;
