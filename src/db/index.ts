import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import * as schema from './schema';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'wrenlo.db');

function connect() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const client = new Database(DB_PATH);
  client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  return client;
}

// Singleton — survives Next.js hot reload in development
declare global {
  // eslint-disable-next-line no-var
  var _sqlite: Database.Database | undefined;
}

export const sqlite = globalThis._sqlite ?? connect();
if (process.env.NODE_ENV !== 'production') globalThis._sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
