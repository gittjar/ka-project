/**
 * GET /api/search?q=hakusana
 *
 * Etsii jäsenistä, tarinoista, juomista, tapahtumista,
 * kuvakansioisista ja yksittäisistä kuvista (caption).
 * Palauttaa max 5 osumaa per kategoria Google-tyyliin:
 * { type, id, title, snippet, url }
 *
 * Auth vaaditaan.
 */

import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Member from '../models/Member.js';
import Story from '../models/Story.js';
import Drink from '../models/Drink.js';
import Event from '../models/Event.js';
import GalleryImage from '../models/GalleryImage.js';
import Folder from '../models/Folder.js';

const router = express.Router();

const MAX_PER_TYPE = 5;
const SNIPPET_LEN  = 120;

/** Lyhentää tekstin ja korostaa hakusanan kontekstin */
function snippet(text, q) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const idx = clean.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return clean.slice(0, SNIPPET_LEN) + (clean.length > SNIPPET_LEN ? '…' : '');
  const start = Math.max(0, idx - 40);
  const end   = Math.min(clean.length, idx + q.length + 80);
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

router.get('/', authMiddleware, async (req, res) => {
  const q = (req.query.q ?? '').toString().trim();
  if (!q || q.length < 2) return res.json([]);
  if (q.length > 100)     return res.status(400).json({ message: 'Hakusana liian pitkä' });

  // Turvallinen regex-haku — escapetetaan erikoismerkit
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');

  const [members, stories, drinks, events, folders, images] = await Promise.all([
    // Jäsenet: nimi, aliakset, sitaatti, sijainti, lempidrinkki
    Member.find({
      $or: [
        { name: rx },
        { aliases: rx },
        { quote: rx },
        { location: rx },
        { favDrink: rx },
      ],
    }).limit(MAX_PER_TYPE).select('name aliases quote location avatarUrl'),

    // Tarinat: otsikko, sisältö, kirjoittaja
    Story.find({
      $or: [{ title: rx }, { content: rx }, { author: rx }],
    }).limit(MAX_PER_TYPE).select('title content author createdAt'),

    // Juomat: nimi, ohje, kirjoittaja
    Drink.find({
      $or: [{ name: rx }, { instructions: rx }, { author: rx }],
    }).limit(MAX_PER_TYPE).select('name instructions author'),

    // Tapahtumat: nimi, kuvaus, sijainti
    Event.find({
      $or: [{ title: rx }, { description: rx }, { location: rx }],
    }).limit(MAX_PER_TYPE).select('title description location startDate'),

    // Kuvakansiot: nimi ja kuvaus
    Folder.find({
      $or: [{ name: rx }, { description: rx }],
    }).limit(MAX_PER_TYPE).select('name description parent').populate('parent', 'name'),

    // Kuvat: kuvateksti (caption)
    GalleryImage.find({ caption: { $regex: rx } })
      .limit(MAX_PER_TYPE)
      .select('caption url folderId uploadedBy')
      .populate('folderId', 'name'),
  ]);

  const results = [];

  for (const m of members) {
    // Etsi missä kentässä osuma on
    const matchField =
      rx.test(m.name)                       ? m.name :
      m.aliases?.find(a => rx.test(a))       ? `Alias: ${m.aliases.find(a => rx.test(a))}` :
      rx.test(m.quote)                       ? m.quote :
      rx.test(m.location)                    ? `📍 ${m.location}` :
      rx.test(m.favDrink)                    ? `🍹 ${m.favDrink}` : m.name;

    results.push({
      type:    'jäsen',
      id:      m._id,
      title:   m.name,
      snippet: snippet(matchField, q),
      url:     '/jasenet',
      avatar:  m.avatarUrl || null,
    });
  }

  for (const s of stories) {
    results.push({
      type:    'tarina',
      id:      s._id,
      title:   s.title,
      snippet: snippet(s.content, q),
      url:     '/tarinat',
      meta:    s.author,
    });
  }

  for (const d of drinks) {
    results.push({
      type:    'juoma',
      id:      d._id,
      title:   d.name,
      snippet: snippet(d.instructions, q),
      url:     '/juomat',
      meta:    d.author,
    });
  }

  for (const e of events) {
    results.push({
      type:    'tapahtuma',
      id:      e._id,
      title:   e.title,
      snippet: snippet(e.description, q),
      url:     '/tapahtumat',
      meta:    e.startDate ? new Date(e.startDate).toLocaleDateString('fi-FI') : null,
    });
  }

  for (const f of folders) {
    const matchText = rx.test(f.name) ? f.name : f.description;
    const parentName = f.parent?.name ?? null;
    results.push({
      type:    'kansio',
      id:      f._id,
      title:   f.name,
      snippet: snippet(matchText, q),
      url:     `/galleria?folder=${f._id}`,
      meta:    parentName ? `📁 ${parentName}` : null,
    });
  }

  for (const img of images) {
    if (!img.caption?.trim()) continue;
    const folderName = img.folderId?.name ?? null;
    results.push({
      type:    'kuva',
      id:      img._id,
      title:   img.caption.slice(0, 60) + (img.caption.length > 60 ? '…' : ''),
      snippet: folderName ? `📁 ${folderName}` : 'Galleria',
      url:     img.folderId ? `/galleria?folder=${img.folderId._id}` : '/galleria',
      meta:    img.uploadedBy ?? null,
      imageUrl: img.url,
    });
  }

  res.json(results);
});

export default router;
