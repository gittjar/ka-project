import express from 'express';
import Member from '../models/Member.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

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
    const { active, points, _id, ...rest } = req.body;
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
    const m = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

export default router;
