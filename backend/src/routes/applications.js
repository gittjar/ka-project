import express from 'express';
import rateLimit from 'express-rate-limit';
import Application from '../models/Application.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 tunti
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Liian monta hakemusta. Yritä uudelleen tunnin kuluttua.' },
});

// POST /api/applications — julkinen, kuka tahansa voi lähettää hakemuksen
router.post('/', applicationLimiter, async (req, res) => {
  try {
    const { name, email, location, favDrink, motivation } = req.body;
    if (!name?.trim() || !email?.trim() || !location?.trim() || !favDrink?.trim() || !motivation?.trim()) {
      return res.status(400).json({ message: 'Kaikki kentät ovat pakollisia' });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'Virheellinen sähköpostiosoite' });
    }
    if (motivation.trim().length < 10) {
      return res.status(400).json({ message: 'Kerro itsestäsi vähän enemmän' });
    }
    const app = new Application({
      name: name.trim(),
      email: email.trim(),
      location: location.trim(),
      favDrink: favDrink.trim(),
      motivation: motivation.trim(),
    });
    await app.save();
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Lähetys epäonnistui' });
  }
});

// GET /api/applications — admin listaa kaikki hakemukset
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const apps = await Application.find({}).sort({ createdAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui' });
  }
});

// GET /api/applications/pending-count — admin: kuinka monta käsittelemätöntä
router.get('/pending-count', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const count = await Application.countDocuments({ status: 'pending' });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui' });
  }
});

// PUT /api/applications/:id — admin päivittää hakemuksen tilan
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Virheellinen tila' });
    }
    const app = await Application.findByIdAndUpdate(
      req.params.id,
      { status, handledBy: req.username, handledAt: new Date() },
      { new: true }
    );
    if (!app) return res.status(404).json({ message: 'Hakemusta ei löydy' });
    res.json(app);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui' });
  }
});

// DELETE /api/applications/:id — admin poistaa hakemuksen kokonaan
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const app = await Application.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ message: 'Hakemusta ei löydy' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui' });
  }
});

export default router;
