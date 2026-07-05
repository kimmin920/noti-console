import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

let client;
let db;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  if (!client) {
    client = postgres(process.env.DATABASE_URL);
    db = drizzle(client, { schema });
  }

  return db;
}

export async function closeDb() {
  if (!client) return;

  const currentClient = client;
  client = undefined;
  db = undefined;

  await currentClient.end({ timeout: 5 });
}
