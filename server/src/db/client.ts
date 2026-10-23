import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import * as schema from './schema.js';

// Prioritize .env.local from project root or server dir
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/AbhishekFarm';

export const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
export default db;

