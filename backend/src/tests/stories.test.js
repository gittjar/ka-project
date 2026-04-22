/**
 * Stories-reittitestit — /api/stories/*
 *
 * Kattaa:
 *  - GET /api/stories         — autentikaatio vaaditaan, palauttaa listan
 *  - GET /api/stories/:id     — yksittäinen tarina kommentteineen
 *  - POST /api/stories        — lisäys (syötteen validointi)
 *  - PUT /api/stories/:id     — omistaja, toinen käyttäjä, admin
 *  - DELETE /api/stories/:id  — omistaja, toinen käyttäjä, admin
 *  - POST /:id/media          — medialatausta (max 5), ilman tiedostoa
 *  - DELETE /:id/media/:mid   — yksittäisen median poisto
 *  - POST /:id/like           — tykkäyksen lisäys/poisto (toggle)
 *  - POST /:id/comments       — kommentointi
 *  - DELETE /:id/comments/:cid — kommenttipoisto (omistaja/admin)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import {
  setupTestDB, teardownTestDB, clearCollections,
  buildApp, createAdminAndToken, createUserAndToken,
} from './testSetup.js';

// Azure Blob Storage -kutsut mockattaan — ei oikeita verkkokutsuja
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      getContainerClient: () => ({
        createIfNotExists: vi.fn().mockResolvedValue({ succeeded: true }),
        setAccessPolicy: vi.fn().mockResolvedValue({}),
        getBlockBlobClient: () => ({
          uploadData: vi.fn().mockResolvedValue({}),
          deleteIfExists: vi.fn().mockResolvedValue({}),
          url: 'https://test.blob.core.windows.net/stories/mock.jpg',
        }),
      }),
    }),
  },
}));

vi.mock('sharp', () => {
  const chainable = () => ({
    jpeg: () => chainable(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  });
  const sharpFn = vi.fn(() => chainable());
  sharpFn.default = sharpFn;
  return { default: sharpFn };
});

vi.mock('heic-convert', () => ({ default: vi.fn().mockResolvedValue(Buffer.from('fake-heic')) }));

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

// ─── GET /api/stories ──────────────────────────────────────────────────────────

describe('GET /api/stories', () => {
  it('vaatii autentikaation (401 ilman tokenia)', async () => {
    const res = await request(app).get('/api/stories');
    expect(res.status).toBe(401);
  });

  it('palauttaa tyhjän listan kirjautuneelle käyttäjälle', async () => {
    const { token } = await createUserAndToken('lukija');
    const res = await request(app).get('/api/stories').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('palauttaa tarinat ilman kommentteja', async () => {
    const { token, user } = await createUserAndToken('kirjoittaja');
    const { default: Story } = await import('../models/Story.js');
    await Story.create({
      title: 'Iso seikkailu',
      content: 'Pitkä tarina...',
      author: user.username,
      authorId: user._id,
      comments: [{ authorId: user._id, username: user.username, content: 'Hieno!' }],
    });
    const res = await request(app).get('/api/stories').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    // Lista-endpoint palauttaa tarinat ilman kommentteja (-comments select)
    expect(res.body[0].comments).toBeUndefined();
    expect(res.body[0].title).toBe('Iso seikkailu');
  });
});

// ─── GET /api/stories/:id ─────────────────────────────────────────────────────

describe('GET /api/stories/:id', () => {
  it('palauttaa yksittäisen tarinan kommentteineen', async () => {
    const { token, user } = await createUserAndToken('tarinahakulukija');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({
      title: 'Yksityistarina',
      content: 'Sisältö',
      author: user.username,
      authorId: user._id,
      comments: [{ authorId: user._id, username: user.username, content: 'Kommentti' }],
    });

    const res = await request(app)
      .get(`/api/stories/${story._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Yksityistarina');
    expect(res.body.comments).toHaveLength(1);
  });

  it('palauttaa 404 kun tarinaa ei löydy', async () => {
    const { token } = await createUserAndToken('haku404');
    const { default: mongoose } = await import('mongoose');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/stories/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/stories ────────────────────────────────────────────────────────

describe('POST /api/stories', () => {
  it('luo tarinan onnistuneesti', async () => {
    const { token, user } = await createUserAndToken('tarinankirjoittaja');
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Uusi tarina', content: 'Pitkä sisältö tarinan alussa...' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Uusi tarina');
    expect(res.body.author).toBe('tarinankirjoittaja');
    expect(res.body.authorId).toBe(user._id.toString());
  });

  it('hylkää jos otsikko puuttuu (400)', async () => {
    const { token } = await createUserAndToken('validoija3');
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Sisältö ilman otsikkoa' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/otsikko/i);
  });

  it('hylkää jos sisältö puuttuu (400)', async () => {
    const { token } = await createUserAndToken('validoija4');
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Otsikko ilman sisältöä' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sisältö/i);
  });

  it('hylkää ilman autentikaatiota (401)', async () => {
    const res = await request(app)
      .post('/api/stories')
      .send({ title: 'Hakukoe', content: 'Sisältö' });
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/stories/:id ─────────────────────────────────────────────────────

describe('PUT /api/stories/:id', () => {
  it('omistaja voi muokata omaa tarinaansa', async () => {
    const { token, user } = await createUserAndToken('tarinanomistaja');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Muokattava', content: 'Sisältö', author: user.username, authorId: user._id });

    const res = await request(app)
      .put(`/api/stories/${story._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Päivitetty otsikko', content: 'Uusi sisältö' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Päivitetty otsikko');
  });

  it('toinen käyttäjä ei voi muokata vierasta tarinaa (403)', async () => {
    const { user: owner } = await createUserAndToken('omistaja5');
    const { token: otherToken } = await createUserAndToken('tunkeilija2');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Suojattu tarina', content: 'Sisältö', author: owner.username, authorId: owner._id });

    const res = await request(app)
      .put(`/api/stories/${story._id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hakattu otsikko' });
    expect(res.status).toBe(403);
  });

  it('admin voi muokata kenen tahansa tarinaa', async () => {
    const { token: adminToken } = await createAdminAndToken();
    const { user: owner } = await createUserAndToken('omistaja6');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Käyttäjän tarina', content: 'Sisältö', author: owner.username, authorId: owner._id });

    const res = await request(app)
      .put(`/api/stories/${story._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin muutti' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Admin muutti');
  });

  it('palauttaa 404 kun tarinaa ei löydy', async () => {
    const { token } = await createAdminAndToken();
    const { default: mongoose } = await import('mongoose');
    const res = await request(app)
      .put(`/api/stories/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ghost tarina' });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/stories/:id ──────────────────────────────────────────────────

describe('DELETE /api/stories/:id', () => {
  it('omistaja voi poistaa oman tarinansa', async () => {
    const { token, user } = await createUserAndToken('poistajaK');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Poistettava', content: 'Sisältö', author: user.username, authorId: user._id });

    const res = await request(app)
      .delete(`/api/stories/${story._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await Story.findById(story._id)).toBeNull();
  });

  it('toinen käyttäjä ei voi poistaa vierasta tarinaa (403)', async () => {
    const { user: owner } = await createUserAndToken('tarinanomistaja2');
    const { token: otherToken } = await createUserAndToken('poistoyritys');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Ei poistu', content: 'Sisältö', author: owner.username, authorId: owner._id });

    const res = await request(app)
      .delete(`/api/stories/${story._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
    expect(await Story.findById(story._id)).not.toBeNull();
  });

  it('admin voi poistaa kenen tahansa tarinan', async () => {
    const { token: adminToken } = await createAdminAndToken();
    const { user: owner } = await createUserAndToken('kadotettava2');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Admin poistaa', content: 'Sisältö', author: owner.username, authorId: owner._id });

    const res = await request(app)
      .delete(`/api/stories/${story._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(await Story.findById(story._id)).toBeNull();
  });
});

// ─── POST /:id/media ──────────────────────────────────────────────────────────

describe('POST /api/stories/:id/media', () => {
  it('lataa kuvatiedoston onnistuneesti', async () => {
    const { token, user } = await createUserAndToken('medianlataaja');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Mediallinen', content: 'Sisältö', author: user.username, authorId: user._id });

    const fakeImg = Buffer.from('iVBORw0KGgo=', 'base64');
    const res = await request(app)
      .post(`/api/stories/${story._id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fakeImg, { filename: 'kuva.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(1);
    expect(res.body.media[0].mediaType).toBe('image');
  });

  it('hylkää latauksen kun media-raja (5) on täynnä (400)', async () => {
    const { token, user } = await createUserAndToken('maxmedia');
    const { default: Story } = await import('../models/Story.js');
    const mediaItems = Array.from({ length: 5 }, (_, i) => ({
      url: `https://test.blob.core.windows.net/stories/kuva${i}.jpg`,
      blobName: `kuva${i}.jpg`,
      mediaType: 'image',
    }));
    const story = await Story.create({
      title: 'Täynnä olevat mediat',
      content: 'Sisältö',
      author: user.username,
      authorId: user._id,
      media: mediaItems,
    });

    const fakeImg = Buffer.from('iVBORw0KGgo=', 'base64');
    const res = await request(app)
      .post(`/api/stories/${story._id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fakeImg, { filename: 'kuva6.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/max 5/i);
  });

  it('hylkää latauksen ilman tiedostoa (400)', async () => {
    const { token, user } = await createUserAndToken('tyhjälataaja');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Tyhjä lataus', content: 'Sisältö', author: user.username, authorId: user._id });

    const res = await request(app)
      .post(`/api/stories/${story._id}/media`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tiedosto/i);
  });

  it('toinen käyttäjä ei voi ladata mediaa vieraaseen tarinaan (403)', async () => {
    const { user: owner } = await createUserAndToken('omistaja7');
    const { token: otherToken } = await createUserAndToken('tunkeilijaMedia');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Suojattu media', content: 'Sisältö', author: owner.username, authorId: owner._id });

    const fakeImg = Buffer.from('iVBORw0KGgo=', 'base64');
    const res = await request(app)
      .post(`/api/stories/${story._id}/media`)
      .set('Authorization', `Bearer ${otherToken}`)
      .attach('file', fakeImg, { filename: 'tunkeutuminen.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /:id/media/:mediaId ───────────────────────────────────────────────

describe('DELETE /api/stories/:id/media/:mediaId', () => {
  it('omistaja voi poistaa median', async () => {
    const { token, user } = await createUserAndToken('mediapoistujaK');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({
      title: 'Medialla',
      content: 'Sisältö',
      author: user.username,
      authorId: user._id,
      media: [{ url: 'https://test.blob.core.windows.net/stories/old.jpg', blobName: 'old.jpg', mediaType: 'image' }],
    });

    const mediaId = story.media[0]._id;
    const res = await request(app)
      .delete(`/api/stories/${story._id}/media/${mediaId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(0);
  });

  it('palauttaa 404 jos mediaa ei löydy', async () => {
    const { token, user } = await createUserAndToken('media404');
    const { default: Story } = await import('../models/Story.js');
    const { default: mongoose } = await import('mongoose');
    const story = await Story.create({ title: 'Tarina', content: 'Sisältö', author: user.username, authorId: user._id });

    const res = await request(app)
      .delete(`/api/stories/${story._id}/media/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── POST /:id/like ───────────────────────────────────────────────────────────

describe('POST /api/stories/:id/like', () => {
  it('lisää tykkäyksen', async () => {
    const { token, user } = await createUserAndToken('tykkaaja');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Tykätty tarina', content: 'Sisältö', author: 'joku', authorId: user._id });

    const res = await request(app)
      .post(`/api/stories/${story._id}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.likes).toHaveLength(1);
    expect(res.body.likes[0].username).toBe('tykkaaja');
  });

  it('poistaa tykkäyksen uudelleenpainaluksella (toggle)', async () => {
    const { token, user } = await createUserAndToken('tykkaajaToggle');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({
      title: 'Togglattava',
      content: 'Sisältö',
      author: 'joku',
      authorId: user._id,
      likes: [{ userId: user._id, username: 'tykkaajaToggle' }],
    });

    const res = await request(app)
      .post(`/api/stories/${story._id}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.likes).toHaveLength(0);
  });
});

// ─── POST /:id/comments ───────────────────────────────────────────────────────

describe('POST /api/stories/:id/comments', () => {
  it('lisää kommentin kirjautuneena', async () => {
    const { token, user } = await createUserAndToken('kommentoija');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Kommentoitava', content: 'Sisältö', author: 'joku', authorId: user._id });

    const res = await request(app)
      .post(`/api/stories/${story._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hieno tarina!' });
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].content).toBe('Hieno tarina!');
    expect(res.body.comments[0].username).toBe('kommentoija');
  });

  it('hylkää tyhjän kommentin (400)', async () => {
    const { token, user } = await createUserAndToken('tyhjäkommentoija');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({ title: 'Tarina', content: 'Sisältö', author: 'joku', authorId: user._id });

    const res = await request(app)
      .post(`/api/stories/${story._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/kommentti/i);
  });
});

// ─── DELETE /:id/comments/:cid ────────────────────────────────────────────────

describe('DELETE /api/stories/:id/comments/:cid', () => {
  it('kommentin kirjoittaja voi poistaa kommentin', async () => {
    const { token, user } = await createUserAndToken('kommentipoistaja');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({
      title: 'Kommenteilla',
      content: 'Sisältö',
      author: user.username,
      authorId: user._id,
      comments: [{ authorId: user._id, username: 'kommentipoistaja', content: 'Poistettava kommentti' }],
    });

    const commentId = story.comments[0]._id;
    const res = await request(app)
      .delete(`/api/stories/${story._id}/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(0);
  });

  it('toinen käyttäjä ei voi poistaa vierasta kommenttia (403)', async () => {
    const { user: owner } = await createUserAndToken('kommentinkirjoittaja');
    const { token: otherToken } = await createUserAndToken('kommentipoistotunkeilija');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({
      title: 'Suojattu kommentti',
      content: 'Sisältö',
      author: owner.username,
      authorId: owner._id,
      comments: [{ authorId: owner._id, username: 'kommentinkirjoittaja', content: 'Minun kommenttini' }],
    });

    const commentId = story.comments[0]._id;
    const res = await request(app)
      .delete(`/api/stories/${story._id}/comments/${commentId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('admin voi poistaa kenen tahansa kommentin', async () => {
    const { token: adminToken } = await createAdminAndToken();
    const { user: owner } = await createUserAndToken('kommentinomistaja3');
    const { default: Story } = await import('../models/Story.js');
    const story = await Story.create({
      title: 'Admin poistaa kommentin',
      content: 'Sisältö',
      author: owner.username,
      authorId: owner._id,
      comments: [{ authorId: owner._id, username: 'kommentinomistaja3', content: 'Hallinnollinen poisto' }],
    });

    const commentId = story.comments[0]._id;
    const res = await request(app)
      .delete(`/api/stories/${story._id}/comments/${commentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(0);
  });
});
