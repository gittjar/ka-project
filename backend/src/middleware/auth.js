import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const SEEN_THROTTLE_MS = 2 * 60 * 1000; // päivitä max 2 min välein

export default function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Kirjautuminen vaaditaan' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.username = payload.username;
    req.role = payload.role;
    // Päivitä lastSeenAt taustalla, ei blokkaa vastausta
    User.findOneAndUpdate(
      { _id: payload.userId, $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: new Date(Date.now() - SEEN_THROTTLE_MS) } }] },
      { lastSeenAt: new Date() }
    ).catch(() => {});
    next();
  } catch {
    res.status(401).json({ message: 'Virheellinen tai vanhentunut token' });
  }
}
