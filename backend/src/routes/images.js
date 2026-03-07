import express from 'express';
import multer from 'multer';
import { BlobServiceClient } from '@azure/storage-blob';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function getBlobClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING puuttuu');
  return BlobServiceClient.fromConnectionString(connStr);
}

// POST /api/images/upload  (multipart: field "file", query: ?container=gallery|avatars)
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    if (!req.file) return res.status(400).json({ message: 'Tiedosto puuttuu' });

    const container = req.query.container || 'gallery';
    const blobService = getBlobClient();
    const containerClient = blobService.getContainerClient(container);
    await containerClient.createIfNotExists({ access: 'blob' });

    const ext = req.file.originalname.split('.').pop();
    const blobName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blockBlob = containerClient.getBlockBlobClient(blobName);

    await blockBlob.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    res.json({ url: blockBlob.url, blobName });
  } catch (err) {
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
    res.json({ message: 'Kuva poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui', error: err.message });
  }
});

export default router;
