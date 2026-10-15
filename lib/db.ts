import { Pool } from 'pg';

const globalForDb = globalThis as unknown as { pool?: Pool };

// The DATABASE_URL copied from managed Postgres providers often includes
// sslmode=require. pg-connection-string currently emits a warning for that
// URL mode, and the explicit `ssl` option below already controls TLS here.
// Remove only that URL parameter so the configured Pool SSL options remain
// authoritative and the warning does not obscure real runtime errors.
function getDatabaseConnectionString(value: string | undefined) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (!url.searchParams.has('sslmode')) return value;
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return value;
  }
}

export const db = globalForDb.pool ?? new Pool({
  connectionString: getDatabaseConnectionString(process.env.DATABASE_URL),
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

if (process.env.NODE_ENV !== 'production') globalForDb.pool = db;
