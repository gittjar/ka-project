import jwt from 'jsonwebtoken';

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
    next();
  } catch {
    res.status(401).json({ message: 'Virheellinen tai vanhentunut token' });
  }
}
