/**
 * Migraatio: siirrä moov-atomi MP4/MOV-videoiden alkuun (faststart)
 * Käyttö: node src/migrate-video-faststart.js
 * Optiot: --dry-run  (ei muutoksia, vain listaa löydetyt videot)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { BlobServiceClient } from '@azure/storage-blob';
import ffmpegStatic from 'ffmpeg-static';
import Ffmpeg from 'fluent-ffmpeg';
Ffmpeg.setFfmpegPath(ffmpegStatic);

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

import GalleryImage from './models/GalleryImage.js';

const DRY_RUN = process.argv.includes('--dry-run');
const CONTAINER = 'gallery';

function getBlobClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('AZURE_STORAGE_CONNECTION_STRING puuttuu');
  return BlobServiceClient.fromConnectionString(connStr);
}

async function applyFaststart(inputBuffer) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpIn  = join(tmpdir(), `ff-in-${id}.mp4`);
  const tmpOut = join(tmpdir(), `ff-out-${id}.mp4`);
  try {
    await writeFile(tmpIn, inputBuffer);
    await new Promise((resolve, reject) => {
      Ffmpeg(tmpIn)
        .outputOptions(['-movflags +faststart', '-c copy'])
        .save(tmpOut)
        .on('end', resolve)
        .on('error', reject);
    });
    return await readFile(tmpOut);
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

async function downloadBlob(containerClient, blobName) {
  const blobClient = containerClient.getBlobClient(blobName);
  return blobClient.downloadToBuffer();
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('✓ MongoDB yhdistetty');

  const videos = await GalleryImage.find({ mediaType: 'video' });
  console.log(`\nLöydettiin ${videos.length} videota${DRY_RUN ? ' (dry-run, ei muutoksia)' : ''}\n`);

  if (videos.length === 0) {
    console.log('Ei videoita, lopetetaan.');
    return;
  }

  if (DRY_RUN) {
    for (const v of videos) {
      console.log(`  ${v.blobName}  (${(v.fileSize / 1024 / 1024).toFixed(1)} Mt)`);
    }
    return;
  }

  const blobService = getBlobClient();
  const containerClient = blobService.getContainerClient(CONTAINER);

  let ok = 0, skipped = 0, failed = 0;

  for (const video of videos) {
    const sizeMb = (video.fileSize / 1024 / 1024).toFixed(1);
    process.stdout.write(`  ${video.blobName} (${sizeMb} Mt) ... `);
    try {
      // Lataa blob Azuresta
      process.stdout.write('lataa... ');
      const originalBuffer = await downloadBlob(containerClient, video.blobName);
      process.stdout.write(`ffmpeg... `);

      // Aja faststart
      const faststartBuffer = await applyFaststart(originalBuffer);
      process.stdout.write(`tallentaa... `);

      // Jos koko ei muuttunut juurikaan, moov oli jo alussa — ohita
      const delta = Math.abs(faststartBuffer.length - originalBuffer.length);
      if (delta < 512) {
        console.log('ohitettu (moov jo alussa)');
        skipped++;
        continue;
      }

      // Ylikirjoita sama blob Azuressa
      const mimeType = video.blobName.match(/\.(webm)$/i) ? 'video/webm' : 'video/mp4';
      const blockBlob = containerClient.getBlockBlobClient(video.blobName);
      await blockBlob.uploadData(faststartBuffer, {
        blobHTTPHeaders: { blobContentType: mimeType },
      });

      // Päivitä fileSize jos muuttui
      if (faststartBuffer.length !== video.fileSize) {
        video.fileSize = faststartBuffer.length;
        await video.save();
      }

      console.log(`valmis (${(faststartBuffer.length / 1024 / 1024).toFixed(1)} Mt)`);
      ok++;
    } catch (err) {
      console.log(`VIRHE: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nValmis: ${ok} käsitelty, ${skipped} ohitettu, ${failed} epäonnistui`);
}

main()
  .catch(err => { console.error('Skripti kaatui:', err); process.exit(1); })
  .finally(() => mongoose.disconnect());
