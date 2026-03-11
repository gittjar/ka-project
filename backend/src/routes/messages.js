import express from 'express';
import Message from '../models/Message.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// POST /api/messages — käyttäjä lähettää viestin adminille
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Viesti ei voi olla tyhjä' });
    const msg = new Message({ from: req.userId, fromUsername: req.username, content: content.trim() });
    await msg.save();
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Lähetys epäonnistui', error: err.message });
  }
});

// GET /api/messages/mine — käyttäjä hakee omat viestinsä
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ from: req.userId }).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// GET /api/messages — admin hakee kaikki viestit
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const messages = await Message.find({}).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// PUT /api/messages/:id/read — admin merkitsee luetuksi
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    await Message.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui', error: err.message });
  }
});

// POST /api/messages/:id/reply — admin vastaa viestiin
router.post('/:id/reply', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Vastaus ei voi olla tyhjä' });
    const msg = await Message.findByIdAndUpdate(
      req.params.id,
      { $push: { replies: { content: content.trim() } }, read: true },
      { new: true }
    );
    if (!msg) return res.status(404).json({ message: 'Viestiä ei löydy' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Vastaus epäonnistui', error: err.message });
  }
});

export default router;
