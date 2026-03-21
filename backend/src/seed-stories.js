/**
 * Tuo stories/-kansion .txt-tiedostot MongoDB:seen
 * Käyttö: node src/seed-stories.js
 * Optiot:  --dry-run   (ei tallenna, tulostaa vain)
 *          --clear     (tyhjentää olemassaolevat tarinat ensin)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';
import Story from './models/Story.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const STORIES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'stories');
const DRY_RUN = process.argv.includes('--dry-run');
const CLEAR   = process.argv.includes('--clear');

// Tiedostot ovat Windows-1252 / Latin-1 -koodauksessa (vanha teksti)
// Node.js lukee 'latin1' = ISO-8859-1, joka kattaa Windows-1252:n useimmissa kohdissa
function readLatin1(filePath) {
  return fs.readFileSync(filePath, 'latin1');
}

// Muunnetaan Windows-1252-merkit niiden Unicode-vastineisiin
function fixEncoding(str) {
  return str
    .replace(/\u0080/g, '€').replace(/\u0082/g, '‚').replace(/\u0083/g, 'ƒ')
    .replace(/\u0084/g, '„').replace(/\u0085/g, '…').replace(/\u0086/g, '†')
    .replace(/\u0087/g, '‡').replace(/\u0088/g, 'ˆ').replace(/\u0089/g, '‰')
    .replace(/\u008a/g, 'Š').replace(/\u008b/g, '‹').replace(/\u008c/g, 'Œ')
    .replace(/\u008e/g, 'Ž').replace(/\u0091/g, '\u2018').replace(/\u0092/g, '\u2019')
    .replace(/\u0093/g, '\u201c').replace(/\u0094/g, '\u201d').replace(/\u0095/g, '•')
    .replace(/\u0096/g, '–').replace(/\u0097/g, '—').replace(/\u0099/g, '™')
    .replace(/\u009a/g, 'š').replace(/\u009b/g, '›').replace(/\u009c/g, 'œ')
    .replace(/\u009e/g, 'ž').replace(/\u009f/g, 'Ÿ');
}

// Poimitaan ensimmäinen merkityksellinen rivi otsikoiksi
function extractTitle(text, fallback) {
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.replace(/^[>\s]+/, '').trim();
    // Ohitetaan IRC-aikaleimakentät, tyhjät rivit ja metatiedot
    if (!line) continue;
    if (/^\[\d{2}:\d{2}\]/.test(line)) continue;          // IRC-lokit [22:52]
    if (/^\(\d{2}:\d{2}\)/.test(line)) continue;          // MUD-lokit (14:08)
    if (/^(Subject|Kentt|From|Sent|To|Date)[\s:]/i.test(line)) continue;
    if (/^-{3,}/.test(line)) continue;
    if (line.length < 4) continue;
    // Siivotaan IRC-nimimerkki pois (Nimi [kanniaalio+]: teksti)
    const ircMsg = line.match(/^[^[]+\[kanniaalio\+\]:\s*(.+)/i);
    if (ircMsg) return ircMsg[1].slice(0, 150);
    return line.slice(0, 150);
  }
  return fallback;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('✓ MongoDB yhdistetty');

  if (CLEAR && !DRY_RUN) {
    const count = await Story.countDocuments();
    await Story.deleteMany({});
    console.log(`🗑  Poistettu ${count} tarinaa`);
  }

  const files = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.txt'));
  console.log(`📂 Löydetty ${files.length} tiedostoa`);

  let added = 0, skipped = 0;

  for (const file of files) {
    const baseName = path.basename(file, '.txt');
    const author = capitalize(baseName);
    const rawText = readLatin1(join(STORIES_DIR, file));
    const content = fixEncoding(rawText).trim();
    const title = extractTitle(content, `${author}n tarina`);

    const existing = await Story.findOne({ author, title });
    if (existing) {
      console.log(`  ⏭  ${file} → jo olemassa`);
      skipped++;
      continue;
    }

    console.log(`  ✚  ${file}`);
    console.log(`     Otsikko : ${title}`);
    console.log(`     Tekijä  : ${author}`);
    console.log(`     Pituus  : ${content.length} merkkiä`);

    if (!DRY_RUN) {
      await Story.create({ title, content, author });
      added++;
    }
  }

  console.log(`\n✓ Valmis — lisätty: ${added}, ohitettu: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Virhe:', err.message);
  process.exit(1);
});
