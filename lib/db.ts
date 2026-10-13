import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

// pg otherwise silently falls back to localhost:5432 when DATABASE_URL is absent.
// In Vercel serverless, that produces a confusing ECONNREFUSED error. Fail clearly
// so the diagnostic log points to the missing Preview environment variable.
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Add the Neon/PostgreSQL connection string to this Vercel environment and redeploy.',
  );
}

const globalForDb = globalThis as unknown as { pool?: Pool };

export const db = globalForDb.pool ?? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

if (process.env.NODE_ENV !== 'production') globalForDb.pool = db;
