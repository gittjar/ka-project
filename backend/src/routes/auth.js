import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Käyttäjänimi ja salasana vaaditaan' });
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'Käyttäjänimi on jo käytössä' });
    const user = new User({ username, password });
    await user.save();
    const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Rekisteröinti epäonnistui', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Väärä käyttäjänimi tai salasana' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Väärä käyttäjänimi tai salasana' });
    const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Kirjautuminen epäonnistui', error: err.message });
  }
});

export default router;
