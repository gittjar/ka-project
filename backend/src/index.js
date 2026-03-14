import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BlobServiceClient } from '@azure/storage-blob';

import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import storyRoutes from './routes/stories.js';
import drinkRoutes from './routes/drinks.js';
import imageRoutes from './routes/images.js';
import messageRoutes from './routes/messages.js';

// Ladataan .env aina backend/-kansiosta riippumatta käynnistyshakemistosta
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/drinks', drinkRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/messages', messageRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

mongoose
  .connect(process.env.MONGODB_URI || '')
  .then(async () => {
    console.log('✓ MongoDB yhdistetty');

    // Tarkista Azure Blob -yhteys
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connStr) {
      try {
        const blobService = BlobServiceClient.fromConnectionString(connStr);
        const props = await blobService.getProperties();
        console.log(`✓ Azure Blob yhdistetty (SKU: ${props.skuName})`);
      } catch (err) {
        console.warn(`⚠ Azure Blob -yhteys epäonnistui: ${err.message}`);
      }
    } else {
      console.warn('⚠ AZURE_STORAGE_CONNECTION_STRING puuttuu');
    }

    app.listen(PORT, () => console.log(`✓ Backend käynnissä portissa ${PORT}`));
  })
  .catch((err) => {
    console.error('✗ MongoDB-yhteys epäonnistui:', err.message);
    process.exit(1);
  });
