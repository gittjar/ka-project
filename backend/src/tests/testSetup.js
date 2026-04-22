/**
 * Yhteinen testihelperi kaikille integraatiotesteille.
 * - Käynnistää MongoMemoryServer (ei oikea MongoDB tarvita)
 * - Rakentaa Express-app ilman mongoose.connect() tai app.listen()
 * - Tarjoaa apufunktiot käyttäjien luomiseen ja tokenien hakuun
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';

// Aseta ympäristömuuttujat ennen reittien latausta
process.env.JWT_SECRET = 'test-secret-kanniaalio';
process.env.NODE_ENV   = 'test';
// Azure Blob on mokattu testeissä — asetamme tyhjän stringin
// jotta getBlobService() ei kaadu ennen kuin mock astuu voimaan
process.env.AZURE_STORAGE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3RrZXk=;EndpointSuffix=core.windows.net';

let mongod;

export async function setupTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function teardownTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

export async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/** Rakentaa Express-app samalla tavalla kuin index.js, mutta ilman mongoose.connect/listen */
export async function buildApp() {
  const { default: cors }    = await import('cors');
  const { default: helmet }  = await import('helmet');

  const { default: authRoutes    } = await import('../routes/auth.js');
  const { default: memberRoutes  } = await import('../routes/members.js');
  const { default: storyRoutes   } = await import('../routes/stories.js');
  const { default: drinkRoutes   } = await import('../routes/drinks.js');

  const app = express();
  app.use(cors());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());

  app.use('/api/auth',    authRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/stories', storyRoutes);
  app.use('/api/drinks',  drinkRoutes);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  return app;
}

/** Luo admin-käyttäjä suoraan tietokantaan ja palauttaa JWT-tokenin */
export async function createAdminAndToken() {
  const { default: User } = await import('../models/User.js');
  const user = await User.create({
    username: 'testiadmin',
    password: 'administraattori123',
    role: 'admin',
    status: 'active',
  });
  const token = jwt.sign(
    { userId: user._id, username: user.username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  return { user, token };
}

/** Luo normaali aktiivinen käyttäjä ja palauttaa JWT-tokenin */
export async function createUserAndToken(username = 'testikayttaja') {
  const { default: User } = await import('../models/User.js');
  const user = await User.create({
    username,
    password: 'salasana1234',
    role: 'user',
    status: 'active',
  });
  const token = jwt.sign(
    { userId: user._id, username: user.username, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  return { user, token };
}

/** Luo InviteCode suoraan kantaan */
export async function createInviteCode(adminUserId, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const { default: InviteCode } = await import('../models/InviteCode.js');
  const code = 'kk-test' + Math.random().toString(36).slice(2, 8);
  return InviteCode.create({
    code,
    createdBy: adminUserId,
    expiresAt: new Date(Date.now() + expiresInMs),
  });
}
