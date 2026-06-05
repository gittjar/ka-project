/**
 * Suorita kerran: node src/setup-azure-cors.js
 * Asettaa Azure Blob Storage -tilille CORS-säännöt jotka sallivat
 * frontendin ladata kuvia suoraan SAS-URL:eilla.
 */
import dotenv from 'dotenv';
dotenv.config();

import { BlobServiceClient } from '@azure/storage-blob';

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connStr) {
  console.error('AZURE_STORAGE_CONNECTION_STRING puuttuu .env-tiedostosta');
  process.exit(1);
}

const client = BlobServiceClient.fromConnectionString(connStr);

const corsRules = [
  {
    allowedOrigins: 'https://kanniaalio.app,http://localhost:5173,http://localhost:4173',
    allowedMethods: 'GET,HEAD,OPTIONS',
    allowedHeaders: '*',
    exposedHeaders: 'Content-Length,Content-Type,Content-Disposition',
    maxAgeInSeconds: 86400,
  },
];

try {
  const props = await client.getProperties();
  props.cors = corsRules;
  await client.setProperties(props);
  console.log('✓ Azure Blob Storage CORS päivitetty:');
  corsRules.forEach(r => console.log(' ', r.allowedOrigins));
} catch (err) {
  console.error('Virhe:', err.message);
  process.exit(1);
}
