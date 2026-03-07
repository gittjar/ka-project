import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import storyRoutes from './routes/stories.js';
import drinkRoutes from './routes/drinks.js';
import imageRoutes from './routes/images.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/drinks', drinkRoutes);
app.use('/api/images', imageRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

mongoose
  .connect(process.env.MONGODB_URI || '')
  .then(() => {
    console.log('MongoDB yhdistetty');
    app.listen(PORT, () => console.log(`Backend käynnissä portissa ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB-yhteys epäonnistui:', err.message);
    process.exit(1);
  });
