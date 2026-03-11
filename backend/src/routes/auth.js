import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import InviteCode from '../models/InviteCode.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/invite — admin luo kutsukoodin
router.post('/invite', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const code = 'kk-' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 päivää
    const invite = new InviteCode({ code, createdBy: req.userId, expiresAt });
    await invite.save();
    res.status(201).json({ code, expiresAt });
  } catch (err) {
    res.status(500).json({ message: 'Kutsukoodi epäonnistui', error: err.message });
  }
});

// GET /api/auth/invites — admin listaa kutsukoodit
router.get('/invites', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const invites = await InviteCode.find({}).sort({ createdAt: -1 });
    res.json(invites);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// POST /api/auth/register — rekisteröidy kutsukoodilla
router.post('/register', async (req, res) => {
  try {
    const { username, password, inviteCode } = req.body;
    if (!username || !password || !inviteCode) {
      return res.status(400).json({ message: 'Käyttäjänimi, salasana ja kutsukoodi vaaditaan' });
    }
    const invite = await InviteCode.findOne({ code: inviteCode });
    if (!invite) return res.status(400).json({ message: 'Virheellinen kutsukoodi' });
    if (invite.usedBy) return res.status(400).json({ message: 'Kutsukoodi on jo käytetty' });
    if (invite.expiresAt < new Date()) return res.status(400).json({ message: 'Kutsukoodi on vanhentunut' });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'Käyttäjänimi on jo käytössä' });

    const user = new User({ username, password, status: 'pending', inviteCode });
    await user.save();

    invite.usedBy = user._id;
    invite.usedAt = new Date();
    await invite.save();

    res.status(201).json({ message: 'Rekisteröinti onnistui. Odota admin-hyväksyntää.' });
  } catch (err) {
    res.status(500).json({ message: 'Rekisteröinti epäonnistui', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Väärä käyttäjänimi tai salasana' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Väärä käyttäjänimi tai salasana' });
    // Admins always get through; regular users need active status
    if (user.role !== 'admin') {
      if (user.status === 'pending') return res.status(403).json({ message: 'Tili odottaa hyväksyntää' });
      if (user.status === 'rejected') return res.status(403).json({ message: 'Tili on hylätty' });
    }
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Kirjautuminen epäonnistui', error: err.message });
  }
});

// GET /api/auth/pending — admin listaa odottavat käyttäjät
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const users = await User.find({ status: 'pending' }).select('-password').sort({ createdAt: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// POST /api/auth/approve/:id — admin hyväksyy käyttäjän
router.post('/approve/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    await User.findByIdAndUpdate(req.params.id, { status: 'active' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Hyväksyntä epäonnistui', error: err.message });
  }
});

// POST /api/auth/reject/:id — admin hylkää käyttäjän
router.post('/reject/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    await User.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Hylkäys epäonnistui', error: err.message });
  }
});

// GET /api/auth/users — admin listaa kaikki ei-admin käyttäjät
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const users = await User.find({ role: 'user' })
      .select('-password')
      .populate('linkedMember', 'name')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// PUT /api/auth/users/:id/link — admin linkittää käyttäjän jäsenprofiiliin
router.put('/users/:id/link', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { memberId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { linkedMember: memberId || null },
      { new: true }
    ).select('-password').populate('linkedMember', 'name');
    if (!user) return res.status(404).json({ message: 'Käyttäjää ei löydy' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Linkitys epäonnistui', error: err.message });
  }
});

export default router;

