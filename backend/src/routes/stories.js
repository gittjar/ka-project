import express from 'express';
import Story from '../models/Story.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json(stories);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const story = new Story(req.body);
    await story.save();
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ message: 'Lisäys epäonnistui', error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const s = await Story.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!s) return res.status(404).json({ message: 'Tarinaa ei löydy' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui', error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    await Story.findByIdAndDelete(req.params.id);
    res.json({ message: 'Tarina poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui', error: err.message });
  }
});

export default router;
