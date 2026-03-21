/**
 * Lisää kovakoodatut drinkit tietokantaan
 * Käyttö: node src/seed-drinks.js [--dry-run]
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Drink from './models/Drink.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

const drinks = [
  {
    name: 'Frozen Eggs',
    instructions: `1. Put couple of icecubes into your underpants
2. Sit very calmly
3. Still stay calm...
4. Dont Panic
5. Drink fast as you can a lot of clear alchol
6. Look c00l`,
    author: 'Caitline',
  },
  {
    name: 'Hangover Recipe',
    instructions: `From having painful hangover, this was rated as 8

Ingredients:
- One suicidal tequila
- One beer with straw
- Couple of danish beers
- One bottle of litovel
- Couple pints of beer (I assume that they were karhu or koff)

Gather the ingredients in your stomach, and act stupidly, and voila! There is a painful hangover for you at tomorrow morning.`,
    author: 'Caitline',
  },
  {
    name: 'Suicidal Tequila',
    instructions: `1. Sniff salt in your nose
2. Drink the tequila
3. Squeeze the lemon into your eye
4. Scream with all your kanniaaliomight SUUUUIIIIIICIDAAAAAAAAAAAAAALLLLLLLLLLLL!!!!!!`,
    author: 'Caitline',
  },
  {
    name: 'Kossumaito',
    instructions: `1. Korkkaa kossu ja maitotölkki
2. Valitse pitkä lasi
3. Kaada n. 1/3 viinaa ja loput maitoa lasiin
4. Lisää jäitä ja punanen pilli, jos löytyy`,
    author: 'Zorru',
  },
  {
    name: 'Festarilikööri',
    instructions: `Sekoitussuhde: 1/3 viskiä, 2/3 kermalikööriä. Nautitaan kylmänä.`,
    author: 'Caitline',
  },
];

async function main() {
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Lisätään ${drinks.length} drinkkiä...\n`);

  if (!DRY_RUN) {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Yhdistetty MongoDBhyn.\n');
  }

  let added = 0;
  let skipped = 0;

  for (const d of drinks) {
    if (DRY_RUN) {
      console.log(`  + ${d.name} (${d.author})`);
      added++;
      continue;
    }
    const exists = await Drink.findOne({ name: d.name });
    if (exists) {
      console.log(`  ~ ${d.name} – ohitetaan (jo kannassa)`);
      skipped++;
    } else {
      await Drink.create(d);
      console.log(`  + ${d.name} – lisätty`);
      added++;
    }
  }

  if (!DRY_RUN) await mongoose.disconnect();
  console.log(`\nValmis! Lisätty: ${added}, ohitettu: ${skipped}`);
}

main().catch(err => {
  console.error('Virhe:', err.message);
  process.exit(1);
});
