import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { BlobServiceClient } from '@azure/storage-blob';
import Member from '../models/Member.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// ── Member photo upload helpers ──────────────────────────────────────────────
const PHOTO_CONTAINER = 'gallery';
const PHOTO_VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;
const SHARP_CONV = /\.(tiff?|bmp|avif)$/i;
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

async function processPhotoBuffer(file) {
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
function getPhotoBlobClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING puuttuu');
  return BlobServiceClient.fromConnectionString(conn);
}
async function uploadPhotoToAzure(file) {
  const blobService = getPhotoBlobClient();
  const containerClient = blobService.getContainerClient(PHOTO_CONTAINER);
  await containerClient.createIfNotExists({ access: 'blob' });
  const isVid = file.mimetype.startsWith('video/') || PHOTO_VIDEO_EXT.test(file.originalname);
  let buffer, mimetype, ext;
  if (isVid) {
    buffer = file.buffer;
    mimetype = (file.mimetype && file.mimetype !== 'application/octet-stream') ? file.mimetype : 'video/mp4';
    ext = file.originalname.split('.').pop()?.toLowerCase() || 'mp4';
  } else {
    const processed = await processPhotoBuffer(file);
    buffer = processed.buffer;
    mimetype = processed.mimetype;
    ext = processed.ext;
  }
  const blobName = `member-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blockBlob = containerClient.getBlockBlobClient(blobName);
  await blockBlob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype } });
  return { url: blockBlob.url, blobName, mediaType: isVid ? 'video' : 'image' };
}
async function deletePhotoBlobIfExists(blobName) {
  if (!blobName) return;
  try {
    const containerClient = getPhotoBlobClient().getContainerClient(PHOTO_CONTAINER);
    await containerClient.deleteBlob(blobName);
  } catch { /* ignore */ }
}
function photoDataFromBody(body) {
  const url = body.url?.trim();
  if (!url) return null;
  return { url, blobName: '', mediaType: PHOTO_VIDEO_EXT.test(url) ? 'video' : 'image' };
}

// GET /api/members — julkinen, vain aktiiviset
router.get('/', async (_req, res) => {
  try {
    const members = await Member.find({ active: true }).collation({ locale: 'fi', strength: 1 }).sort({ name: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// GET /api/members/admin — admin, kaikki jäsenet (myös inaktiiviset)
router.get('/admin', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const members = await Member.find({}).collation({ locale: 'fi', strength: 1 }).sort({ name: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// GET /api/members/mine — käyttäjä hakee oman linked memberin
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.linkedMember) return res.status(404).json({ message: 'Ei linkitettyä jäsenprofiilia' });
    const member = await Member.findById(user.linkedMember);
    if (!member) return res.status(404).json({ message: 'Jäsenprofiilia ei löydy' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// PUT /api/members/mine — käyttäjä päivittää oman linked memberin
router.put('/mine', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.linkedMember) return res.status(404).json({ message: 'Ei linkitettyä jäsenprofiilia' });
    // Käyttäjä ei saa muuttaa aktiivisuutta tai pisteitä
    const { active, points, _id, photos: _p, ...rest } = req.body;
    const m = await Member.findByIdAndUpdate(user.linkedMember, rest, { new: true });
    if (!m) return res.status(404).json({ message: 'Jäsenprofiilia ei löydy' });
    res.json(m);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui', error: err.message });
  }
});

// GET /api/members/:id
router.get('/:id', async (req, res) => {
  try {
    const m = await Member.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Jäsentä ei löydy' });
    res.json(m);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const member = new Member(req.body);
    await member.save();
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ message: 'Lisäys epäonnistui', error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { photos: _p, ...updateData } = req.body; // photos managed via separate endpoints
    const m = await Member.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!m) return res.status(404).json({ message: 'Jäsentä ei löydy' });
    res.json(m);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui', error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    await Member.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ message: 'Jäsen poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui', error: err.message });
  }
});

// ── MEMBER PHOTOS ─────────────────────────────────────────────────────────────

// POST /api/members/mine/photos  – user adds own photo (file or URL)
router.post('/mine/photos', authMiddleware, photoUpload.single('file'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.linkedMember) return res.status(404).json({ message: 'Ei linkitettyä jäsenprofiilia' });
    const m = await Member.findById(user.linkedMember);
    if (!m) return res.status(404).json({ message: 'Jäsentä ei löydy' });
    if (m.photos.length >= 10) return res.status(400).json({ message: 'Maksimi 10 kuvaa/videota' });
    const photoData = req.file ? await uploadPhotoToAzure(req.file) : photoDataFromBody(req.body);
    if (!photoData) return res.status(400).json({ message: 'Tiedosto tai URL vaaditaan' });
    m.photos.push({ ...photoData, sortOrder: m.photos.length });
    await m.save();
    res.json(m);
  } catch (err) { res.status(500).json({ message: 'Kuvan lisäys epäonnistui', error: err.message }); }
});

// DELETE /api/members/mine/photos/:photoId
router.delete('/mine/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.linkedMember) return res.status(404).json({ message: 'Ei linkitettyä jäsenprofiilia' });
    const m = await Member.findById(user.linkedMember);
    if (!m) return res.status(404).json({ message: 'Jäsentä ei löydy' });
    const photo = m.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ message: 'Kuvaa ei löydy' });
    await deletePhotoBlobIfExists(photo.blobName);
    photo.deleteOne();
    await m.save();
    res.json(m);
  } catch (err) { res.status(500).json({ message: 'Poisto epäonnistui', error: err.message }); }
});

// POST /api/members/:id/photos  – admin only
router.post('/:id/photos', authMiddleware, photoUpload.single('file'), async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const m = await Member.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Jäsentä ei löydy' });
    if (m.photos.length >= 10) return res.status(400).json({ message: 'Maksimi 10 kuvaa/videota' });
    const photoData = req.file ? await uploadPhotoToAzure(req.file) : photoDataFromBody(req.body);
    if (!photoData) return res.status(400).json({ message: 'Tiedosto tai URL vaaditaan' });
    m.photos.push({ ...photoData, sortOrder: m.photos.length });
    await m.save();
    res.json(m);
  } catch (err) { res.status(500).json({ message: 'Kuvan lisäys epäonnistui', error: err.message }); }
});

// DELETE /api/members/:id/photos/:photoId  – admin only
router.delete('/:id/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const m = await Member.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Jäsentä ei löydy' });
    const photo = m.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ message: 'Kuvaa ei löydy' });
    await deletePhotoBlobIfExists(photo.blobName);
    photo.deleteOne();
    await m.save();
    res.json(m);
  } catch (err) { res.status(500).json({ message: 'Poisto epäonnistui', error: err.message }); }
});

export default router;
