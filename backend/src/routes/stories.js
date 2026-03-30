import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { BlobServiceClient } from '@azure/storage-blob';
import authMiddleware from '../middleware/auth.js';
import Story from '../models/Story.js';

const router = express.Router();
const CONTAINER = 'stories';

const VIDEO_EXT    = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i;
const HEIC_EXT     = /\.(heic|heif)$/i;
const ACCEPTED_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|mp4|mov|m4v|webm|3gp|mkv|avi)$/i;

// 1 GB limit (video support)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') ||
               file.mimetype.startsWith('video/') ||
               ACCEPTED_EXT.test(file.originalname);
    cb(null, ok);
  },
});

function getBlobContainer() {
  const cc = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
    .getContainerClient(CONTAINER);
  return cc;
}

async function ensureContainer() {
  const cc = getBlobContainer();
  const result = await cc.createIfNotExists({ access: 'blob' });
  if (!result.succeeded) {
    // Container already existed — ensure public blob access in case it was created as private
    try { await cc.setAccessPolicy('blob'); } catch { /* ignore */ }
  }
  return cc;
}

// Ensure the stories container is public at startup so existing blobs are accessible
(async () => {
  try {
    const cc = getBlobContainer();
    await cc.createIfNotExists({ access: 'blob' });
    await cc.setAccessPolicy('blob');
  } catch { /* non-fatal — storage may not be configured yet */ }
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
  const ext = name.split('.').pop()?.toLowerCase() || 'bin';
  return { buffer: file.buffer, mimetype: mime || 'application/octet-stream', ext };
}

// ── GET / ── auth required, returns list without comments for performance
router.get('/', authMiddleware, async (_req, res) => {
  try {
    const stories = await Story.find()
      .sort({ title: 1 })
      .select('-comments');
    res.json(stories);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui' });
  }
});

// ── GET /:id ── full story incl. comments
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    res.json(story);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui' });
  }
});

// ── POST / ── kirjautunut käyttäjä luo tarinan
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Otsikko vaaditaan' });
    if (!content?.trim()) return res.status(400).json({ message: 'Sisältö vaaditaan' });
    const story = await Story.create({
      title: title.trim(),
      content: content.trim(),
      author:   req.username,
      authorId: req.userId,
    });
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ message: 'Lisäys epäonnistui' });
  }
});

// ── PUT /:id ── tarinan kirjoittaja tai admin voi muokata
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    const isOwner = story.authorId?.toString() === req.userId || story.author === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia muokata tarinaa' });
    const { title, content } = req.body;
    if (title !== undefined) story.title = title.trim();
    if (content !== undefined) story.content = content.trim();
    await story.save();
    res.json(story);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui' });
  }
});

// ── DELETE /:id ── kirjoittaja tai admin poistaa + siivoaa blobit
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    const isOwner = story.authorId?.toString() === req.userId || story.author === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia poistaa tarinaa' });
    if (story.media.length) {
      try {
        const cc = await ensureContainer();
        for (const m of story.media) {
          if (m.blobName) await cc.getBlockBlobClient(m.blobName).deleteIfExists();
        }
      } catch { /* blob cleanup failure is non-fatal */ }
    }
    await story.deleteOne();
    res.json({ message: 'Tarina poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui' });
  }
});

// ── POST /:id/media ── lataa kuva tai video (max 5 per tarina)
router.post('/:id/media', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    const isOwner = story.authorId?.toString() === req.userId || story.author === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
    if (story.media.length >= 5) return res.status(400).json({ message: 'Max 5 mediaa per tarina' });
    if (!req.file) return res.status(400).json({ message: 'Tiedosto puuttuu' });
    const isVid = req.file.mimetype.startsWith('video/') || VIDEO_EXT.test(req.file.originalname);
    const cc = await ensureContainer();
    let url, blobName;
    if (isVid) {
      const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'mp4';
      blobName = `${story._id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const bc = cc.getBlockBlobClient(blobName);
      await bc.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
      url = bc.url;
    } else {
      const { buffer, mimetype, ext } = await processImage(req.file);
      blobName = `${story._id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const bc = cc.getBlockBlobClient(blobName);
      await bc.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype } });
      url = bc.url;
    }
    story.media.push({ url, blobName, mediaType: isVid ? 'video' : 'image' });
    await story.save();
    res.json({ media: story.media });
  } catch (err) {
    res.status(500).json({ message: 'Lataus epäonnistui' });
  }
});

// ── DELETE /:id/media/:mediaId ── poista yksittäinen media (kirjoittaja tai admin)
router.delete('/:id/media/:mediaId', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    const isOwner = story.authorId?.toString() === req.userId || story.author === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
    const mediaItem = story.media.id(req.params.mediaId);
    if (!mediaItem) return res.status(404).json({ message: 'Mediaa ei löydy' });
    try {
      const cc = await ensureContainer();
      if (mediaItem.blobName) await cc.getBlockBlobClient(mediaItem.blobName).deleteIfExists();
    } catch { /* non-fatal */ }
    story.media.pull({ _id: req.params.mediaId });
    await story.save();
    res.json({ media: story.media });
  } catch (err) {
    res.status(500).json({ message: 'Mediapoisto epäonnistui' });
  }
});

// ── POST /:id/like ── toggle tykkäys
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    const idx = story.likes.findIndex(l => l.userId?.toString() === req.userId);
    if (idx !== -1) {
      story.likes.splice(idx, 1);
    } else {
      story.likes.push({ userId: req.userId, username: req.username });
    }
    await story.save();
    res.json({ likes: story.likes });
  } catch (err) {
    res.status(500).json({ message: 'Tykkäys epäonnistui' });
  }
});

// ── POST /:id/comments ── lisää kommentti
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Kommentti ei saa olla tyhjä' });
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    story.comments.push({ authorId: req.userId, username: req.username, content: content.trim() });
    await story.save();
    res.json({ comments: story.comments });
  } catch (err) {
    res.status(500).json({ message: 'Kommentointi epäonnistui' });
  }
});

// ── DELETE /:id/comments/:cid ── poista kommentti (kirjoittaja tai admin)
router.delete('/:id/comments/:cid', authMiddleware, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    const comment = story.comments.id(req.params.cid);
    if (!comment) return res.status(404).json({ message: 'Kommenttia ei löydy' });
    const isOwner = comment.authorId?.toString() === req.userId || comment.username === req.username;
    if (!isOwner && req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
    story.comments.pull({ _id: req.params.cid });
    await story.save();
    res.json({ comments: story.comments });
  } catch (err) {
    res.status(500).json({ message: 'Kommenttipoisto epäonnistui' });
  }
});

export default router;
