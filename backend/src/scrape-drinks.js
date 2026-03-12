/**
 * Tripod-juomasivu → MongoDB -tuonti
 * Käyttö: node src/scrape-drinks.js [--dry-run] [--dump]
 *   --dry-run  Ei tallenna, vain tulostaa löydetyt drinkit
 *   --dump     Tallentaa raa'an HTML:n tiedostoon drinks-dump.html debuggausta varten
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import Drink from './models/Drink.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const TRIPOD_URL = 'https://kanniaalio.tripod.com/juomat.html';
const DRY_RUN = process.argv.includes('--dry-run');
const DUMP = process.argv.includes('--dump');

function stripTags(str) {
  return str
    .replace(/<br\s*\/?>/gi, '\n')  // <br> → rivinvaihto ensin
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#160;/gi, ' ')
    .trim();
}

/**
 * Yrittää parsia HTML:stä drinkit useammalla strategialla.
 * Tripod-sivut vaihtelevat rakenteeltaan – kokeillaan useampaa tapaa.
 */
function parseDrinks(html) {
  const drinks = [];

  // --- Strategia 1: <tr>-lohkot, joissa on bold-nimi + ohje ---
  // Tyypillinen vanha Tripod-rakenne: taulukko jossa joka rivi on yksi drinkki
  const trBlocks = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const [, block] of trBlocks) {
    // Nimi on usein ensimmäisessä <td>:ssä, bold tai font-tagilla
    const tdParts = [...block.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (tdParts.length < 2) continue;

    const nameRaw = stripTags(tdParts[0]);
    const instrRaw = stripTags(tdParts.slice(1).join('\n'));
    if (!nameRaw || nameRaw.length < 2 || instrRaw.length < 5) continue;
    // Suodata pois header-rivit
    if (/^(drinkki|nimi|name|juoma|ohje)/i.test(nameRaw)) continue;

    drinks.push({
      name: nameRaw.replace(/^\d+[\.\)]\s*/, '').trim(),
      instructions: instrRaw.replace(/\n{3,}/g, '\n\n').trim(),
      author: 'Kanniaali',
    });
  }

  if (drinks.length > 0) return deduplicate(drinks);

  // --- Strategia 2: <p>- tai <div>-lohkot, bold-nimi + teksti ---
  // Jos ei taulukkoa, kokeillaan löytää <b>Nimi</b> + seuraava teksti
  const boldMatches = [...html.matchAll(/<b[^>]*>([\s\S]*?)<\/b>([\s\S]*?)(?=<b[^>]*>|<hr|<\/body)/gi)];
  for (const [, namePart, instrPart] of boldMatches) {
    const name = stripTags(namePart).trim();
    const instr = stripTags(instrPart).trim();
    if (!name || name.length < 2 || name.length > 80) continue;
    if (instr.length < 5) continue;
    if (/^(drinkki|nimi|name|juoma|ohje|tervetuloa|kanniaali)/i.test(name)) continue;
    drinks.push({ name, instructions: instr, author: 'Kanniaali' });
  }

  return deduplicate(drinks);
}

function deduplicate(drinks) {
  const seen = new Set();
  return drinks.filter(d => {
    const key = d.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  console.log(`Haetaan: ${TRIPOD_URL}`);

  const res = await fetch(TRIPOD_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} – sivu ei aukea`);

  // Tripod-sivut ovat ISO-8859-1
  const buffer = await res.arrayBuffer();
  const html = new TextDecoder('iso-8859-1').decode(buffer);

  if (DUMP) {
    const dumpPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'drinks-dump.html');
    fs.writeFileSync(dumpPath, html, 'utf-8');
    console.log(`HTML tallennettu: ${dumpPath}`);
  }

  const drinks = parseDrinks(html);

  if (drinks.length === 0) {
    console.log('\n❌ Ei löydetty yhtään drinkkiä. Aja --dump ja katso HTML-rakenne.');
    process.exit(1);
  }

  console.log(`\nLöydettiin ${drinks.length} drinkkiä:\n`);
  drinks.forEach((d, i) => {
    const preview = d.instructions.replace(/\n/g, ' ').slice(0, 60);
    console.log(`  ${String(i + 1).padStart(3)}. ${d.name}`);
    console.log(`       → ${preview}${d.instructions.length > 60 ? '…' : ''}`);
  });

  if (DRY_RUN) {
    console.log('\n--dry-run: ei tallenneta tietokantaan.');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('\nYhdistetty MongoDBhyn, tallennetaan...');

  let added = 0;
  let skipped = 0;

  for (const d of drinks) {
    const exists = await Drink.findOne({ name: d.name });
    if (exists) {
      skipped++;
    } else {
      await Drink.create(d);
      added++;
    }
  }

  await mongoose.disconnect();
  console.log(`\nValmis! Lisätty: ${added}, ohitettu (duplikaatti): ${skipped}`);
}

main().catch(err => {
  console.error('Virhe:', err.message);
  process.exit(1);
});
