/**
 * Tripod-jäsensivu → MongoDB -tuonti
 * Käyttö: node src/scrape-members.js
 * Optiot: node src/scrape-members.js --dry-run   (ei tallenna, vain tulostaa)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Member from './models/Member.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const TRIPOD_URL = 'https://kanniaalio.tripod.com/jasenet.html';
const DRY_RUN = process.argv.includes('--dry-run');

function stripTags(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractField(block, label) {
  const re = new RegExp(`<b[^>]*>${label}[^<]*</[bB]>\\s*([^<\\n]*)`, 'i');
  const m = block.match(re);
  return m ? stripTags(m[1]).trim() : '';
}

function parseAliases(raw) {
  return raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
}

function parsePoints(raw) {
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

function extractAvatar(block) {
  const m = block.match(/SRC="(members\/[^"]+)"/i);
  return m ? `https://kanniaalio.tripod.com/${m[1]}` : '';
}

function parseMembers(html) {
  const members = [];
  const trBlocks = [...html.matchAll(/<tr[^>]*VALIGN\s*=\s*['"]*TOP['"]*[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const [, block] of trBlocks) {
    const nameMatch = block.match(/<i[^>]*>[\s\S]*?<font[^>]+size\s*=\s*["']?\+1["']?[^>]*>([\s\S]*?)<\/font>[\s\S]*?<\/i>/i);
    if (!nameMatch) continue;

    const name = stripTags(nameMatch[1]);
    if (!name || name.length < 2) continue;

    const aliasRaw = extractField(block, 'Alias(?:es)?');
    const aliases = aliasRaw ? parseAliases(aliasRaw) : [];
    const quote = extractField(block, 'Kuote');
    const born = extractField(block, 'Syntynyt');
    const pointsRaw = extractField(block, 'K[^<]{0,20}pisteet');
    const highestPromille = extractField(block, 'Korkein promille');
    const favDrink = extractField(block, 'Juoma');
    const location = extractField(block, 'Pelipaikka');
    const websiteRaw = extractField(block, 'Kotisivu');
    const website = (websiteRaw && !['ei oo', '-', 'ei tuu', ''].includes(websiteRaw.toLowerCase()))
      ? websiteRaw : '';
    const avatarUrl = extractAvatar(block);

    members.push({ name, aliases, quote, born, points: parsePoints(pointsRaw), highestPromille, favDrink, location, website, avatarUrl, active: true });
  }

  return members;
}

async function main() {
  console.log(`Haetaan: ${TRIPOD_URL}`);

  const res = await fetch(TRIPOD_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Sivu on ISO-8859-1 — dekoodataan oikein
  const buffer = await res.arrayBuffer();
  const html = new TextDecoder('iso-8859-1').decode(buffer);

  const members = parseMembers(html);

  // Poista duplikaatit nimellä
  const seen = new Set();
  const unique = members.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });

  console.log(`\nLöydettiin ${unique.length} jäsentä:\n`);
  unique.forEach((m, i) => {
    const aliases = m.aliases.length ? ` (${m.aliases.join(', ')})` : '';
    const img = m.avatarUrl ? ' 📷' : '';
    console.log(`  ${String(i + 1).padStart(3)}. ${m.name}${aliases}${img}`);
  });

  if (DRY_RUN) {
    console.log('\n--dry-run: ei tallenneta tietokantaan.');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('\nYhdistetty MongoDBhyn, tallennetaan...');

  let added = 0;
  let skipped = 0;

  for (const m of unique) {
    const exists = await Member.findOne({ name: m.name });
    if (exists) {
      skipped++;
    } else {
      await Member.create(m);
      added++;
    }
  }

  console.log(`\nValmis! Lisätty: ${added}, ohitettu: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Virhe:', err.message);
  process.exit(1);
});
