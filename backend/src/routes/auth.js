import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import InviteCode from '../models/InviteCode.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_LOCK_MS = 60 * 60 * 1000; // 1h

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
    if (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 32) {
      return res.status(400).json({ message: 'Käyttäjänimen tulee olla 2–32 merkkiä' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Salasanan tulee olla 8–128 merkkiä' });
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
    if (!username || !password) {
      return res.status(400).json({ message: 'Käyttäjänimi ja salasana vaaditaan' });
    }

    const user = await User.findOne({ username });

    // Timing-hyökkäyssuoja: tee bcrypt-vertailu myös kun käyttäjää ei löydy
    if (!user) {
      await bcrypt.compare(password, '$2b$12$invalidhashpaddingtomatchtime000000000000000000000000000');
      return res.status(401).json({ message: 'Väärä käyttäjänimi tai salasana' });
    }

    // Tarkista lukitus
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ message: `Tili lukittu liian monien epäonnistuneiden kirjautumisyritysten takia. Yritä uudelleen ${mins} minuutin kuluttua.` });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update = { failedLoginAttempts: attempts };
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOGIN_LOCK_MS);
      }
      await User.findByIdAndUpdate(user._id, update);
      const remaining = LOGIN_MAX_ATTEMPTS - attempts;
      const msg = remaining > 0
        ? `Väärä käyttäjänimi tai salasana (${remaining} yritystä jäljellä)`
        : 'Tili lukittu tunniksi liian monien epäonnistuneiden kirjautumisyritysten takia.';
      return res.status(401).json({ message: msg });
    }

    // Admins always get through; regular users need active status
    if (user.role !== 'admin') {
      if (user.status === 'pending') return res.status(403).json({ message: 'Tili odottaa hyväksyntää' });
      if (user.status === 'rejected') return res.status(403).json({ message: 'Tili on hylätty' });
    }

    // Nollaa epäonnistuneet yritykset onnistuneen kirjautumisen jälkeen
    await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0, lockedUntil: null });

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

// GET /api/auth/users — admin listaa kaikki käyttäjät
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const users = await User.find()
      .select('-password')
      .populate('linkedMember', 'name')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

// PUT /api/auth/users/:id/role — admin asettaa käyttäjän roolin
router.put('/users/:id/role', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Virheellinen rooli' });
    if (req.params.id === req.userId) return res.status(400).json({ message: 'Et voi muuttaa omaa rooliasi' });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password').populate('linkedMember', 'name');
    if (!user) return res.status(404).json({ message: 'Käyttäjää ei löydy' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Roolin muutos epäonnistui', error: err.message });
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

// POST /api/auth/change-password — oma salasananvaihto (vaatii vanhan)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Vanha ja uusi salasana vaaditaan' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ message: 'Salasanan tulee olla 8–128 merkkiä' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Käyttäjää ei löydy' });
    const ok = await user.comparePassword(oldPassword);
    if (!ok) return res.status(400).json({ message: 'Vanha salasana on virheellinen' });
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Salasananvaihto epäonnistui', error: err.message });
  }
});

// PUT /api/auth/users/:id/password — admin asettaa salasanan suoraan (ei vaadi vanhaa)
router.put('/users/:id/password', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const { newPassword } = req.body;
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ message: 'Salasanan tulee olla 8–128 merkkiä' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Käyttäjää ei löydy' });
    user.password = newPassword;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Salasananvaihto epäonnistui', error: err.message });
  }
});

// PUT /api/auth/users/:id/force-password-change — admin pakottaa / poistaa pakotuksen
router.put('/users/:id/force-password-change', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const force = req.body.force !== false;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { mustChangePassword: force },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'Käyttäjää ei löydy' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Toiminto epäonnistui', error: err.message });
  }
});

export default router;

