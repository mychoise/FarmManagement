import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import * as schema from './schema.js';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/AbhishekFarm';

export const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
export default db;
