/**
 * Drinks-reittitestit — /api/drinks/*
 *
 * Kattaa:
 *  - GET /api/drinks    — julkinen haku
 *  - POST /api/drinks   — lisäys (autentikaatio, syötteen validointi, tiedostolatausta)
 *  - PUT /api/drinks/:id  — muokkaus (omistaja vs. toinen käyttäjä vs. admin)
 *  - DELETE /api/drinks/:id — poisto (omistaja, muu käyttäjä, admin)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import {
  setupTestDB, teardownTestDB, clearCollections,
  buildApp, createAdminAndToken, createUserAndToken,
} from './testSetup.js';

// Azure Blob Storage -kutsut mockattaan — testit eivät ota verkkoyhteyteen
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      getContainerClient: () => ({
        createIfNotExists: vi.fn().mockResolvedValue({ succeeded: true }),
        setAccessPolicy: vi.fn().mockResolvedValue({}),
        getBlockBlobClient: () => ({
          uploadData: vi.fn().mockResolvedValue({}),
          deleteIfExists: vi.fn().mockResolvedValue({}),
          url: 'https://test.blob.core.windows.net/gallery/mock-drink.jpg',
        }),
        deleteBlob: vi.fn().mockResolvedValue({}),
      }),
    }),
  },
}));

// sharp: palauttaa alkuperäinen puskuri muuttumattomana testissä
vi.mock('sharp', () => {
  const chainable = () => ({
    jpeg: () => chainable(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  });
  const sharpFn = vi.fn(() => chainable());
  sharpFn.default = sharpFn;
  return { default: sharpFn };
});

// heic-convert ei tarvita JPEG-testimedialle
vi.mock('heic-convert', () => ({ default: vi.fn().mockResolvedValue(Buffer.from('fake-heic-converted')) }));

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

// ─── GET /api/drinks ───────────────────────────────────────────────────────────

describe('GET /api/drinks', () => {
  it('palauttaa tyhjän listan kun juomia ei ole', async () => {
    const res = await request(app).get('/api/drinks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('ei vaadi autentikaatiota', async () => {
    const res = await request(app).get('/api/drinks');
    expect(res.status).toBe(200);
  });

  it('palauttaa drinkit aakkosjärjestyksessä', async () => {
    const { default: Drink } = await import('../models/Drink.js');
    await Drink.create([
      { name: 'Öljydrinkki', instructions: 'Ohje', author: 'testi' },
      { name: 'Aamupalju', instructions: 'Ohje', author: 'testi' },
      { name: 'Metsäkastike', instructions: 'Ohje', author: 'testi' },
    ]);
    const res = await request(app).get('/api/drinks');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].name).toBe('Aamupalju');
    expect(res.body[2].name).toBe('Öljydrinkki');
  });
});

// ─── POST /api/drinks ──────────────────────────────────────────────────────────

describe('POST /api/drinks', () => {
  it('lisää drinkin onnistuneesti (ilman mediaa)', async () => {
    const { token } = await createUserAndToken('drinkkikayttaja');
    const res = await request(app)
      .post('/api/drinks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Testijuoma', instructions: 'Kaada lasiin' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Testijuoma');
    expect(res.body.author).toBe('drinkkikayttaja');
    expect(res.body._id).toBeTruthy();
  });

  it('hylkää lisäyksen ilman autentikaatiota (401)', async () => {
    const res = await request(app)
      .post('/api/drinks')
      .send({ name: 'Testijuoma', instructions: 'Ohje' });
    expect(res.status).toBe(401);
  });

  it('hylkää jos nimi puuttuu (400)', async () => {
    const { token } = await createUserAndToken('validoija1');
    const res = await request(app)
      .post('/api/drinks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ', instructions: 'Ohje' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nimi ja ohje/i);
  });

  it('hylkää jos ohje puuttuu (400)', async () => {
    const { token } = await createUserAndToken('validoija2');
    const res = await request(app)
      .post('/api/drinks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Juoma' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nimi ja ohje/i);
  });

  it('lisää drinkin kuvatiedostolla', async () => {
    const { token } = await createUserAndToken('kuvaaja');
    const fakeImage = Buffer.from('iVBORw0KGgo=', 'base64'); // pieni fake PNG
    const res = await request(app)
      .post('/api/drinks')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Kuvallinen juoma')
      .field('instructions', 'Ohje kuvatiedostolla')
      .attach('media', fakeImage, { filename: 'drink.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.mediaUrl).toBeTruthy();
    expect(res.body.mediaType).toBe('image');
  });
});

// ─── PUT /api/drinks/:id ───────────────────────────────────────────────────────

describe('PUT /api/drinks/:id', () => {
  it('omistaja voi muokata drinkkiä', async () => {
    const { token, user } = await createUserAndToken('omistaja');
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Alkuperäinen', instructions: 'Vanha ohje', author: user.username });

    const res = await request(app)
      .put(`/api/drinks/${drink._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Muokattu nimi', instructions: 'Uusi ohje' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Muokattu nimi');
  });

  it('toinen käyttäjä ei voi muokata vieraan drinkkiä (403)', async () => {
    const { user: owner } = await createUserAndToken('omistaja2');
    const { token: otherToken } = await createUserAndToken('ulkopuolinen');
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Suojattu', instructions: 'Ohje', author: owner.username });

    const res = await request(app)
      .put(`/api/drinks/${drink._id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hakkeroitu nimi' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/ei oikeutta/i);
  });

  it('admin voi muokata kenen tahansa drinkkiä', async () => {
    const { token: adminToken } = await createAdminAndToken();
    const { user: owner } = await createUserAndToken('drinkkiomistaja');
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Käyttäjän drinkki', instructions: 'Ohje', author: owner.username });

    const res = await request(app)
      .put(`/api/drinks/${drink._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin muutti nimen' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Admin muutti nimen');
  });

  it('palauttaa 404 kun drinkkiä ei löydy', async () => {
    const { token } = await createAdminAndToken();
    const { default: mongoose } = await import('mongoose');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/drinks/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost drinkki' });
    expect(res.status).toBe(404);
  });

  it('hylkää pyynnön ilman autentikaatiota (401)', async () => {
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Julkinen', instructions: 'Ohje', author: 'joku' });
    const res = await request(app).put(`/api/drinks/${drink._id}`).send({ name: 'Hax' });
    expect(res.status).toBe(401);
  });

  it('omistaja voi poistaa median (removeMedia=true)', async () => {
    const { token, user } = await createUserAndToken('mediaomistaja');
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({
      name: 'Mediallinen',
      instructions: 'Ohje',
      author: user.username,
      mediaUrl: 'https://test.blob.core.windows.net/gallery/old.jpg',
      mediaType: 'image',
      blobName: 'old.jpg',
    });

    const res = await request(app)
      .put(`/api/drinks/${drink._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ removeMedia: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.mediaUrl).toBe('');
    expect(res.body.blobName).toBe('');
  });
});

// ─── DELETE /api/drinks/:id ────────────────────────────────────────────────────

describe('DELETE /api/drinks/:id', () => {
  it('omistaja voi poistaa oman drinkkinsä', async () => {
    const { token, user } = await createUserAndToken('poistaja');
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Poistettava', instructions: 'Ohje', author: user.username });

    const res = await request(app)
      .delete(`/api/drinks/${drink._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/poistettu/i);

    const found = await Drink.findById(drink._id);
    expect(found).toBeNull();
  });

  it('toinen käyttäjä ei voi poistaa vierasta drinkkiä (403)', async () => {
    const { user: owner } = await createUserAndToken('tosellinomistaja');
    const { token: otherToken } = await createUserAndToken('tunkeilija');
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Ei poisteta', instructions: 'Ohje', author: owner.username });

    const res = await request(app)
      .delete(`/api/drinks/${drink._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);

    const found = await Drink.findById(drink._id);
    expect(found).not.toBeNull();
  });

  it('admin voi poistaa kenen tahansa drinkin', async () => {
    const { token: adminToken } = await createAdminAndToken();
    const { user: owner } = await createUserAndToken('kadottava');
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Admin poistaa', instructions: 'Ohje', author: owner.username });

    const res = await request(app)
      .delete(`/api/drinks/${drink._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const found = await Drink.findById(drink._id);
    expect(found).toBeNull();
  });

  it('palauttaa 404 kun drinkkiä ei löydy', async () => {
    const { token } = await createAdminAndToken();
    const { default: mongoose } = await import('mongoose');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/drinks/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('hylkää pyynnön ilman autentikaatiota (401)', async () => {
    const { default: Drink } = await import('../models/Drink.js');
    const drink = await Drink.create({ name: 'Suojattu', instructions: 'Ohje', author: 'joku' });
    const res = await request(app).delete(`/api/drinks/${drink._id}`);
    expect(res.status).toBe(401);
  });
});
