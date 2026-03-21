import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { BlobServiceClient } from '@azure/storage-blob';
import Drink from '../models/Drink.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// ── Azure / upload helpers ────────────────────────────────────────────────────
const CONTAINER = 'gallery';
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
const HEIC_EXT  = /\.(heic|heif)$/i;
const SHARP_CONV = /\.(tiff?|bmp|avif|webp)$/i;
const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

function getBlobService() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING puuttuu');
  return BlobServiceClient.fromConnectionString(conn);
}

async function processBuffer(file) {
  const name = file.originalname;
  const mime = file.mimetype || '';
  if (HEIC_EXT.test(name) || mime === 'image/heic' || mime === 'image/heif') {
    const out = await heicConvert({ buffer: file.buffer, format: 'JPEG', quality: 0.88 });
    return { buffer: Buffer.from(out), mimetype: 'image/jpeg', ext: 'jpg' };
  }
  if (SHARP_CONV.test(name) || ['image/tiff', 'image/bmp', 'image/avif', 'image/webp'].includes(mime)) {
    const buffer = await sharp(file.buffer).jpeg({ quality: 88 }).toBuffer();
    return { buffer, mimetype: 'image/jpeg', ext: 'jpg' };
  }
  const ext = name.split('.').pop()?.toLowerCase() || 'bin';
  const detectedMime = MIME_BY_EXT[ext] || (mime !== 'application/octet-stream' ? mime : '') || 'image/jpeg';
  return { buffer: file.buffer, mimetype: detectedMime, ext };
}

async function uploadToAzure(file) {
  const containerClient = getBlobService().getContainerClient(CONTAINER);
  await containerClient.createIfNotExists({ access: 'blob' });
  const isVid = file.mimetype.startsWith('video/') || VIDEO_EXT.test(file.originalname);
  let buffer, mimetype, ext;
  if (isVid) {
    buffer = file.buffer;
    mimetype = (file.mimetype && file.mimetype !== 'application/octet-stream') ? file.mimetype : 'video/mp4';
    ext = file.originalname.split('.').pop()?.toLowerCase() || 'mp4';
  } else {
    const p = await processBuffer(file);
    buffer = p.buffer; mimetype = p.mimetype; ext = p.ext;
  }
  const blobName = `drink-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blockBlob = containerClient.getBlockBlobClient(blobName);
  await blockBlob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype } });
  return { url: blockBlob.url, blobName, mediaType: isVid ? 'video' : 'image' };
}

async function deleteBlobIfExists(blobName) {
  if (!blobName) return;
  try {
    await getBlobService().getContainerClient(CONTAINER).deleteBlob(blobName);
  } catch { /* ignore */ }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const drinks = await Drink.find().sort({ name: 1 });
    res.json(drinks);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const { name, instructions } = req.body;
    if (!name?.trim() || !instructions?.trim())
      return res.status(400).json({ message: 'Nimi ja ohje vaaditaan' });

    let mediaUrl = '', mediaType = '', blobName = '';
    if (req.file) {
      const result = await uploadToAzure(req.file);
      mediaUrl = result.url; mediaType = result.mediaType; blobName = result.blobName;
    }

    const drink = new Drink({
      name: name.trim(), instructions: instructions.trim(),
      author: req.username,
      mediaUrl, mediaType, blobName,
      imageUrl: mediaType === 'image' ? mediaUrl : '',
    });
    await drink.save();
    res.status(201).json(drink);
  } catch (err) {
    res.status(500).json({ message: 'Lisäys epäonnistui', error: err.message });
  }
});

router.put('/:id', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const drink = await Drink.findById(req.params.id);
    if (!drink) return res.status(404).json({ message: 'Drinkkiä ei löydy' });
    if (req.role !== 'admin' && drink.author !== req.username)
      return res.status(403).json({ message: 'Ei oikeutta muokata' });

    const { name, instructions, removeMedia } = req.body;
    if (name?.trim()) drink.name = name.trim();
    if (instructions?.trim()) drink.instructions = instructions.trim();

    // Remove existing media if requested or new file uploaded
    if ((removeMedia === 'true' || req.file) && drink.blobName) {
      await deleteBlobIfExists(drink.blobName);
      drink.mediaUrl = ''; drink.mediaType = ''; drink.blobName = ''; drink.imageUrl = '';
    }

    if (req.file) {
      const result = await uploadToAzure(req.file);
      drink.mediaUrl = result.url;
      drink.mediaType = result.mediaType;
      drink.blobName = result.blobName;
      drink.imageUrl = result.mediaType === 'image' ? result.url : '';
    }

    await drink.save();
    res.json(drink);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui', error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const drink = await Drink.findById(req.params.id);
    if (!drink) return res.status(404).json({ message: 'Drinkkiä ei löydy' });
    if (req.role !== 'admin' && drink.author !== req.username)
      return res.status(403).json({ message: 'Ei oikeutta poistaa' });

    await deleteBlobIfExists(drink.blobName);
    await drink.deleteOne();
    res.json({ message: 'Drinkki poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui', error: err.message });
  }
});

export default router;
