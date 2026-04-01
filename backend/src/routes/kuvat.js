import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { BlobServiceClient } from '@azure/storage-blob';
import GalleryImage from '../models/GalleryImage.js';
import ShareToken from '../models/ShareToken.js';

const router = express.Router();
const CONTAINER = 'gallery';

// Rate limit julkisille jako-reiteille: 60 pyyntöä / 15 min per IP
const shareRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Liian monta pyyntöä, odota hetki.' },
});

// Palauttaa true jos pyyntö tulee selaimesta (navigointi), false jos kuvapyyntö (<img src>, <video>)
function isBrowserNav(req) {
  const accept = req.headers.accept || '';
  return accept.includes('text/html');
}

// Tarkistaa JWT tokenin joko Authorization-headeristä tai query-parametrista ?t=
function isAuthenticated(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.t;
  if (!token) return false;
  try {
    jwt.verify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Apufunktio: stream blob vastaukseen (range-tuki)
async function streamBlob(res, blobName, rangeHeader) {
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
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const dl = await blobClient.download(start, chunkSize);
    dl.readableStreamBody.pipe(res);
  } else {
    res.setHeader('Content-Type', contentType);
    if (total > 0) res.setHeader('Content-Length', String(total));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const dl = await blobClient.download(0);
    dl.readableStreamBody.pipe(res);
  }
}

// GET /kuvat/s/:token  — julkinen jako: kuvaa voi katsoa kaikki joilla on linkki
router.get('/s/:token', shareRateLimit, async (req, res) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  try {
    const share = await ShareToken.findOne({ token: req.params.token });
    if (!share) return res.status(404).end();
    await streamBlob(res, share.blobName, req.headers.range);
  } catch {
    if (!res.headersSent) res.status(500).end();
  }
});

// GET /kuvat/**  — proxy-stream gallerian blobeja sivuston omalla domainilla.
// Viimeinen polkusegmentti = blobName (esim. 1711234567890-abc.jpg).
// Muut segmentit (esim. kansionimi) ovat vain kosmeettisia ja jätetään huomiotta.
// Range-pyyntöjä tuetaan, jotta video-scrubbing toimii selaimessa.
router.get('/{*path}', async (req, res) => {
  // Salli cross-origin kuvapyynnöt (frontend voi olla eri domainilla)
  const origin = req.headers.origin;
  const allowed = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
    : ['http://localhost:5173'];
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  // Salli cross-origin upotus myös ilman crossorigin-attribuuttia (COEP-yhteensopivuus)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Selaimen suora navigointi virheelliseen polkuun → ohjaa frontendin galleriasivulle
  if (isBrowserNav(req)) {
    const frontendOrigin = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',')[0].trim()
      : 'http://localhost:5173';
    return res.redirect(302, `${frontendOrigin}/galleria`);
  }

  try {
    const segments = req.path.split('/').filter(Boolean);
    const blobName = decodeURIComponent(segments[segments.length - 1] || '');
    if (!blobName) return res.status(404).end();

    // Kuvapyynnöt (<img src>) eivät lähetä Authorization-headeria automaattisesti,
    // joten autentikointi hoidetaan tässä query-parametrilla ?t= tai headerillä.
    // Ilman tokenia palautetaan 401 — <img src> näyttää broken image -ikonin
    // eikä vuoda tietoa siitä mitä kuvat ovat.
    if (!isAuthenticated(req)) {
      return res.status(401).end();
    }

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
