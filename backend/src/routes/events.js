import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { BlobServiceClient } from '@azure/storage-blob';
import authMiddleware from '../middleware/auth.js';
import Event from '../models/Event.js';

const router = express.Router();
const CONTAINER = 'events';
const HEIC_EXT  = /\.(heic|heif)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') ||
               /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i.test(file.originalname);
    cb(null, ok);
  },
});

function getContainer() {
  return BlobServiceClient
    .fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
    .getContainerClient(CONTAINER);
}

async function ensureContainer() {
  const cc = getContainer();
  const result = await cc.createIfNotExists({ access: 'blob' });
  if (!result.succeeded) {
    try { await cc.setAccessPolicy('blob'); } catch { /* ignore */ }
  }
  return cc;
}

// Ensure public access at startup
(async () => {
  try {
    const cc = getContainer();
    await cc.createIfNotExists({ access: 'blob' });
    await cc.setAccessPolicy('blob');
  } catch { /* non-fatal */ }
})();

async function processImage(file) {
  const name = file.originalname;
  const mime = file.mimetype || '';
  if (HEIC_EXT.test(name) || mime === 'image/heic' || mime === 'image/heif') {
    const out = await heicConvert({ buffer: file.buffer, format: 'JPEG', quality: 0.88 });
    return { buffer: Buffer.from(out), mimetype: 'image/jpeg', ext: 'jpg' };
  }
  if (/\.(tiff?|bmp|avif)$/i.test(name) || ['image/tiff', 'image/bmp', 'image/avif'].includes(mime)) {
    const buffer = await sharp(file.buffer).jpeg({ quality: 88 }).toBuffer();
    return { buffer, mimetype: 'image/jpeg', ext: 'jpg' };
  }
  // Resize hero image: max 1400px wide, keep aspect
  if (mime.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(name)) {
    const buffer = await sharp(file.buffer)
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { buffer, mimetype: 'image/jpeg', ext: 'jpg' };
  }
  const ext = name.split('.').pop()?.toLowerCase() || 'bin';
  return { buffer: file.buffer, mimetype: mime || 'application/octet-stream', ext };
}

// ── GET / ── kaikki tapahtumat, auth required
router.get('/', authMiddleware, async (_req, res) => {
  try {
    const events = await Event.find().sort({ startDate: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui' });
  }
});

// ── GET /upcoming ── tulevat tapahtumat (julkinen, NavBar-badgea varten)
router.get('/upcoming', async (_req, res) => {
  try {
    const count = await Event.countDocuments({ startDate: { $gt: new Date() } });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui' });
  }
});

// ── POST / ── create, any logged-in user
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, startDate, endDate, location, contactName, contactPhone } = req.body;
    if (!title?.trim())  return res.status(400).json({ message: 'Nimi vaaditaan' });
    if (!startDate)      return res.status(400).json({ message: 'Alkamisaika vaaditaan' });
    const event = await Event.create({
      title: title.trim(),
      description: description?.trim() || '',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      location: location?.trim() || '',
      contactName: contactName?.trim() || '',
      contactPhone: contactPhone?.trim() || '',
      createdBy:   req.username,
      createdById: req.userId,
    });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Luonti epäonnistui' });
  }
});

// ── PUT /:id ── edit, creator or admin
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Tapahtumaa ei löydy' });
    const isOwner = event.createdById === req.userId || event.createdBy === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
    const { title, description, startDate, endDate, location, contactName, contactPhone } = req.body;
    if (title !== undefined)        event.title        = title.trim();
    if (description !== undefined)  event.description  = description.trim();
    if (startDate !== undefined)    event.startDate    = new Date(startDate);
    if (endDate !== undefined)      event.endDate      = endDate ? new Date(endDate) : null;
    if (location !== undefined)     event.location     = location.trim();
    if (contactName !== undefined)  event.contactName  = contactName.trim();
    if (contactPhone !== undefined) event.contactPhone = contactPhone.trim();
    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui' });
  }
});

// ── DELETE /:id ── creator or admin, cleans blob
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Tapahtumaa ei löydy' });
    const isOwner = event.createdById === req.userId || event.createdBy === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
    if (event.blobName) {
      try {
        const cc = await ensureContainer();
        await cc.getBlockBlobClient(event.blobName).deleteIfExists();
      } catch { /* non-fatal */ }
    }
    await event.deleteOne();
    res.json({ message: 'Tapahtuma poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui' });
  }
});

// ── POST /:id/image ── upload/replace hero image
router.post('/:id/image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Tapahtumaa ei löydy' });
    const isOwner = event.createdById === req.userId || event.createdBy === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
    if (!req.file) return res.status(400).json({ message: 'Tiedosto puuttuu' });
    const cc = await ensureContainer();
    // Delete old blob
    if (event.blobName) {
      try { await cc.getBlockBlobClient(event.blobName).deleteIfExists(); } catch { /* ignore */ }
    }
    const { buffer, mimetype, ext } = await processImage(req.file);
    const blobName = `${event._id}/${Date.now()}.${ext}`;
    const bc = cc.getBlockBlobClient(blobName);
    await bc.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype } });
    event.imageUrl  = bc.url;
    event.blobName  = blobName;
    await event.save();
    res.json({ imageUrl: event.imageUrl });
  } catch (err) {
    res.status(500).json({ message: 'Kuvien lataus epäonnistui' });
  }
});

// ── DELETE /:id/image ── remove hero image
router.delete('/:id/image', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Tapahtumaa ei löydy' });
    const isOwner = event.createdById === req.userId || event.createdBy === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
    if (event.blobName) {
      try {
        const cc = await ensureContainer();
        await cc.getBlockBlobClient(event.blobName).deleteIfExists();
      } catch { /* non-fatal */ }
    }
    event.imageUrl = '';
    event.blobName = '';
    await event.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui' });
  }
});

// ── POST /:id/rsvp ── toggle RSVP (attending / not_attending / maybe)
router.post('/:id/rsvp', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['attending', 'not_attending', 'maybe'].includes(status)) {
      return res.status(400).json({ message: 'Virheellinen status' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Tapahtumaa ei löydy' });
    const idx = event.rsvps.findIndex(r => r.userId === req.userId);
    if (idx !== -1) {
      if (event.rsvps[idx].status === status) {
        // Same status clicked again → remove RSVP
        event.rsvps.splice(idx, 1);
      } else {
        event.rsvps[idx].status = status;
      }
    } else {
      event.rsvps.push({ userId: req.userId, username: req.username, status });
    }
    await event.save();
    res.json({ rsvps: event.rsvps });
  } catch (err) {
    res.status(500).json({ message: 'RSVP epäonnistui' });
  }
});

export default router;
