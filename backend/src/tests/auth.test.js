/**
 * Autentikaatiotestit — /api/auth/*
 *
 * Kattaa:
 *  - Rekisteröinti: onnistuu kutsukoodilla, epäonnistuu virhesyöttöillä
 *  - Kirjautuminen: onnistuu, väärä salasana, pending/rejected tili
 *  - Admin-toiminnot: kutsukoodi, pending-lista, approve, reject, role
 *  - Middleware: suojattu endpoint ilman tokenia / väärällä tokenilla
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import {
  setupTestDB, teardownTestDB, clearCollections,
  buildApp, createAdminAndToken, createUserAndToken, createInviteCode,
} from './testSetup.js';

// Azure Blob Storage -kutsut mockattaan — auth-reiteillä ei blob-kutsuja,
// mutta stories/drinks importoivat BlobServiceClient moduulin tasolla
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      getContainerClient: () => ({
        createIfNotExists: vi.fn().mockResolvedValue({}),
        setAccessPolicy: vi.fn().mockResolvedValue({}),
        getBlockBlobClient: () => ({
          uploadData: vi.fn().mockResolvedValue({}),
          deleteIfExists: vi.fn().mockResolvedValue({}),
          url: 'https://test.blob.core.windows.net/gallery/test.jpg',
        }),
        deleteBlob: vi.fn().mockResolvedValue({}),
      }),
      getProperties: vi.fn().mockResolvedValue({ skuName: 'Standard_LRS' }),
    }),
  },
}));

let app;

beforeAll(async () => {
  await setupTestDB();
  app = await buildApp();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearCollections();
});

// ─── /api/health ──────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('palauttaa ok:true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('kirjautuu onnistuneesti admin-käyttäjällä', async () => {
    const { user } = await createAdminAndToken();
    const res = await request(app).post('/api/auth/login').send({
      username: user.username,
      password: 'administraattori123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.username).toBe(user.username);
    expect(res.body.role).toBe('admin');
  });

  it('kirjautuu onnistuneesti aktiivisella käyttäjällä', async () => {
    const { user } = await createUserAndToken('kirjautuja');
    const res = await request(app).post('/api/auth/login').send({
      username: 'kirjautuja',
      password: 'salasana1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('hylkää väärän salasanan (401)', async () => {
    const { user } = await createUserAndToken('kayttaja2');
    const res = await request(app).post('/api/auth/login').send({
      username: user.username,
      password: 'vaarasalasana',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/väärä/i);
  });

  it('hylkää tuntemattoman käyttäjänimen (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'eitunnettu',
      password: 'jotain',
    });
    expect(res.status).toBe(401);
  });

  it('hylkää pending-tilin (403)', async () => {
    const { default: User } = await import('../models/User.js');
    await User.create({ username: 'odottaja', password: 'salasana1234', role: 'user', status: 'pending' });
    const res = await request(app).post('/api/auth/login').send({
      username: 'odottaja',
      password: 'salasana1234',
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/hyväksyntää/i);
  });

  it('hylkää rejected-tilin (403)', async () => {
    const { default: User } = await import('../models/User.js');
    await User.create({ username: 'hylätty', password: 'salasana1234', role: 'user', status: 'rejected' });
    const res = await request(app).post('/api/auth/login').send({
      username: 'hylätty',
      password: 'salasana1234',
    });
    expect(res.status).toBe(403);
  });

  it('vaatii käyttäjänimen ja salasanan (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'vain' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/register ───────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('rekisteröityy onnistuneesti kutsukoodilla', async () => {
    const { user: admin } = await createAdminAndToken();
    const invite = await createInviteCode(admin._id);
    const res = await request(app).post('/api/auth/register').send({
      username: 'uusikayttaja',
      password: 'salasana1234',
      inviteCode: invite.code,
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/onnistui/i);
  });

  it('hylkää lyhyen käyttäjänimen (400)', async () => {
    const { user: admin } = await createAdminAndToken();
    const invite = await createInviteCode(admin._id);
    const res = await request(app).post('/api/auth/register').send({
      username: 'a',
      password: 'salasana1234',
      inviteCode: invite.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2.32/);
  });

  it('hylkää liian lyhyen salasanan (400)', async () => {
    const { user: admin } = await createAdminAndToken();
    const invite = await createInviteCode(admin._id);
    const res = await request(app).post('/api/auth/register').send({
      username: 'kayttaja',
      password: 'lyhyt',
      inviteCode: invite.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8.128/);
  });

  it('hylkää virheellisen kutsukoodin (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'kayttaja',
      password: 'salasana1234',
      inviteCode: 'kk-eiole',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/kutsukoodi/i);
  });

  it('hylkää jo käytetyn kutsukoodin (400)', async () => {
    const { user: admin } = await createAdminAndToken();
    const invite = await createInviteCode(admin._id);
    // Käytä koodi kerran
    await request(app).post('/api/auth/register').send({
      username: 'ensimmainen',
      password: 'salasana1234',
      inviteCode: invite.code,
    });
    // Yritä käyttää uudestaan
    const res = await request(app).post('/api/auth/register').send({
      username: 'toinen',
      password: 'salasana1234',
      inviteCode: invite.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/käytetty/i);
  });

  it('hylkää vanhentueen kutsukoodin (400)', async () => {
    const { default: InviteCode } = await import('../models/InviteCode.js');
    const { user: admin } = await createAdminAndToken();
    const expired = await InviteCode.create({
      code: 'kk-vanhakk',
      createdBy: admin._id,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await request(app).post('/api/auth/register').send({
      username: 'myöhässä',
      password: 'salasana1234',
      inviteCode: expired.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/vanhentunut/i);
  });

  it('hylkää duplikaatti käyttäjänimen (409)', async () => {
    const { user: admin } = await createAdminAndToken();
    const invite1 = await createInviteCode(admin._id);
    const invite2 = await createInviteCode(admin._id);
    await request(app).post('/api/auth/register').send({
      username: 'kahdesti',
      password: 'salasana1234',
      inviteCode: invite1.code,
    });
    const res = await request(app).post('/api/auth/register').send({
      username: 'kahdesti',
      password: 'salasana1234',
      inviteCode: invite2.code,
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/käytössä/i);
  });
});

// ─── Auth middleware ───────────────────────────────────────────────────────────

describe('Auth middleware', () => {
  it('hylkää pyynnön ilman tokenia (401) suojatulle reitille', async () => {
    const res = await request(app).get('/api/stories');
    expect(res.status).toBe(401);
  });

  it('hylkää pyynnön väärällä tokenilla (401)', async () => {
    const res = await request(app)
      .get('/api/stories')
      .set('Authorization', 'Bearer väärätoken');
    expect(res.status).toBe(401);
  });

  it('hyväksyy pyynnön oikealla tokenilla', async () => {
    const { token } = await createUserAndToken('tokentest');
    const res = await request(app)
      .get('/api/stories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ─── Admin-toiminnot ───────────────────────────────────────────────────────────

describe('Admin — kutsukoodi ja käyttäjähallinta', () => {
  it('admin luo kutsukoodin (201)', async () => {
    const { token } = await createAdminAndToken();
    const res = await request(app)
      .post('/api/auth/invite')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^kk-/);
    expect(res.body.expiresAt).toBeTruthy();
  });

  it('tavallinen käyttäjä ei voi luoda kutsukoodia (403)', async () => {
    const { token } = await createUserAndToken('peruskäyttäjä');
    const res = await request(app)
      .post('/api/auth/invite')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('admin listaa odottavat käyttäjät', async () => {
    const { default: User } = await import('../models/User.js');
    const { token } = await createAdminAndToken();
    await User.create({ username: 'pending1', password: 'salasana1234', status: 'pending' });
    await User.create({ username: 'pending2', password: 'salasana1234', status: 'pending' });
    const res = await request(app)
      .get('/api/auth/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // Ei salasanakenttää vastauksessa
    res.body.forEach(u => expect(u.password).toBeUndefined());
  });

  it('admin hyväksyy käyttäjän (approve)', async () => {
    const { default: User } = await import('../models/User.js');
    const { token } = await createAdminAndToken();
    const pending = await User.create({ username: 'odottaja2', password: 'salasana1234', status: 'pending' });
    const res = await request(app)
      .post(`/api/auth/approve/${pending._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const updated = await User.findById(pending._id);
    expect(updated.status).toBe('active');
  });

  it('admin hylkää käyttäjän (reject)', async () => {
    const { default: User } = await import('../models/User.js');
    const { token } = await createAdminAndToken();
    const pending = await User.create({ username: 'hylättävä', password: 'salasana1234', status: 'pending' });
    const res = await request(app)
      .post(`/api/auth/reject/${pending._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const updated = await User.findById(pending._id);
    expect(updated.status).toBe('rejected');
  });

  it('admin asettaa käyttäjälle admin-roolin', async () => {
    const { token, user: admin } = await createAdminAndToken();
    const { user: target } = await createUserAndToken('ylennettävä');
    const res = await request(app)
      .put(`/api/auth/users/${target._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('admin ei voi muuttaa omaa rooliaan (400)', async () => {
    const { token, user: admin } = await createAdminAndToken();
    const res = await request(app)
      .put(`/api/auth/users/${admin._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'user' });
    expect(res.status).toBe(400);
  });

  it('virheellinen rooli hylätään (400)', async () => {
    const { token } = await createAdminAndToken();
    const { user } = await createUserAndToken('muutettava');
    const res = await request(app)
      .put(`/api/auth/users/${user._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'supervillain' });
    expect(res.status).toBe(400);
  });
});
