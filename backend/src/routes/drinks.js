import express from 'express';
import Drink from '../models/Drink.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const drinks = await Drink.find().sort({ name: 1 });
    res.json(drinks);
  } catch (err) {
    res.status(500).json({ message: 'Haku epäonnistui', error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, instructions, imageUrl } = req.body;
    const drink = new Drink({
      name,
      instructions,
      imageUrl: imageUrl || '',
      author: req.username,
    });
    await drink.save();
    res.status(201).json(drink);
  } catch (err) {
    res.status(500).json({ message: 'Lisäys epäonnistui', error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    const d = await Drink.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!d) return res.status(404).json({ message: 'Drinkkiä ei löydy' });
    res.json(d);
  } catch (err) {
    res.status(500).json({ message: 'Päivitys epäonnistui', error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Admin-oikeus vaaditaan' });
    await Drink.findByIdAndDelete(req.params.id);
    res.json({ message: 'Drinkki poistettu' });
  } catch (err) {
    res.status(500).json({ message: 'Poisto epäonnistui', error: err.message });
  }
});

export default router;
