import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Setting from '../models/Setting.js';

const router = express.Router();
const PIN_KEY = 'guides_pin';
const DEFAULT_PIN = process.env.GUIDES_DEFAULT_PIN ?? '000000';

async function getPin() {
  const s = await Setting.findOne({ key: PIN_KEY });
  return s ? s.value : DEFAULT_PIN;
}

// POST /api/guides/verify — public, verify PIN
router.post('/verify', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: 'PIN puuttuu' });
    const current = await getPin();
    if (pin !== current) return res.status(401).json({ message: 'Väärä PIN' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Virhe' });
  }
});

// PUT /api/guides/pin — admin only, update PIN
router.put('/pin', authMiddleware, async (req, res) => {
  if (req.role !== 'admin') return res.status(403).json({ message: 'Ei oikeuksia' });
  try {
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 20) {
      return res.status(400).json({ message: 'PIN oltava 4–20 merkkiä' });
    }
    await Setting.findOneAndUpdate(
      { key: PIN_KEY },
      { value: pin },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Tallennus epäonnistui' });
  }
});

export default router;
