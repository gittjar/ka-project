import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';
import GalleryImage from '../models/GalleryImage.js';

const router = express.Router();
const CONTAINER = 'gallery';

// GET /kuvat/**  — proxy-stream gallerian blobeja sivuston omalla domainilla.
// Viimeinen polkusegmentti = blobName (esim. 1711234567890-abc.jpg).
// Muut segmentit (esim. kansionimi) ovat vain kosmeettisia ja jätetään huomiotta.
// Range-pyyntöjä tuetaan, jotta video-scrubbing toimii selaimessa.
router.get('/{*path}', async (req, res) => {
  try {
    const segments = req.path.split('/').filter(Boolean);
    const blobName = decodeURIComponent(segments[segments.length - 1] || '');
    if (!blobName) return res.status(404).end();

    const image = await GalleryImage.findOne({ blobName }).select('mediaType');
    if (!image) return res.status(404).end();

    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) return res.status(500).end();

    const blobClient = BlobServiceClient.fromConnectionString(connStr)
      .getContainerClient(CONTAINER)
      .getBlockBlobClient(blobName);

    const props = await blobClient.getProperties();
    const contentType = props.contentType || (image.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    const total = props.contentLength ?? 0;

    const rangeHeader = req.headers.range;
    if (rangeHeader && total > 0) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : total - 1;
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', String(chunkSize));
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      const dl = await blobClient.download(start, chunkSize);
      dl.readableStreamBody.pipe(res);
    } else {
      res.setHeader('Content-Type', contentType);
      if (total > 0) res.setHeader('Content-Length', String(total));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      const dl = await blobClient.download(0);
      dl.readableStreamBody.pipe(res);
    }
  } catch {
    if (!res.headersSent) res.status(500).end();
  }
});

export default router;
