#!/usr/bin/env node
/**
 * Backfill marketplace_location_search in bounded, restartable batches.
 * Usage: NEON_DATABASE_URL=... node scripts/backfill_location_search_projection.mjs [batch-size]
 * Safe to re-run: only source locations missing from the projection are selected.
 */
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  console.error('Set NEON_DATABASE_URL before running this script.');
  process.exit(1);
}

const parsedBatchSize = Number.parseInt(process.argv[2] || '5000', 10);
const batchSize = Number.isFinite(parsedBatchSize)
  ? Math.min(Math.max(parsedBatchSize, 500), 20000)
  : 5000;

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
  statement_timeout: 120000,
  application_name: 'diginanba-location-projection-backfill',
});

const sql = `
WITH RECURSIVE batch AS MATERIALIZED (
  SELECT l.id, l.parent_id, l.country_code, l.location_type, l.name,
         l.normalized_name, l.aliases, l.postal_code, l.latitude, l.longitude,
         l.source_updated_at
  FROM marketplace_locations l
  WHERE l.is_active
    AND NOT EXISTS (
      SELECT 1 FROM marketplace_location_search s WHERE s.location_id = l.id
    )
  ORDER BY l.id
  LIMIT $1
),
ancestry AS (
  SELECT b.id AS match_id, l.id, l.parent_id, l.name, l.location_type, 0 AS depth
  FROM batch b
  JOIN marketplace_locations l ON l.id = b.id
  UNION ALL
  SELECT a.match_id, p.id, p.parent_id, p.name, p.location_type, a.depth + 1
  FROM ancestry a
  JOIN marketplace_locations p ON p.id = a.parent_id
  WHERE a.depth < 8
),
hierarchy AS (
  SELECT match_id,
    max(name) FILTER (WHERE location_type = 'city') AS city,
    max(name) FILTER (WHERE location_type = 'town') AS town,
    max(name) FILTER (WHERE location_type = 'village') AS village,
    max(name) FILTER (WHERE location_type = 'district') AS district,
    max(name) FILTER (WHERE location_type = 'state') AS state,
    max(name) FILTER (WHERE location_type = 'country') AS country
  FROM ancestry
  GROUP BY match_id
)
INSERT INTO marketplace_location_search (
  location_id, country_code, location_type, name, normalized_name,
  normalized_aliases, city, town, village, district, state, country,
  postal_code, latitude, longitude, search_document, source_updated_at, projected_at
)
SELECT b.id, b.country_code, b.location_type, b.name, b.normalized_name,
  ARRAY(
    SELECT DISTINCT lower(unaccent(trim(alias_value)))
    FROM unnest(COALESCE(b.aliases, ARRAY[]::text[])) AS alias_value
    WHERE trim(alias_value) <> ''
  ),
  h.city, h.town, h.village, h.district, h.state, h.country,
  b.postal_code, b.latitude, b.longitude,
  lower(unaccent(concat_ws(' ', b.name, array_to_string(b.aliases, ' '),
    h.city, h.town, h.village, h.district, h.state, h.country, b.postal_code))),
  b.source_updated_at, now()
FROM batch b
LEFT JOIN hierarchy h ON h.match_id = b.id
ON CONFLICT (location_id) DO NOTHING
`;

let total = 0;
try {
  for (;;) {
    const result = await pool.query(sql, [batchSize]);
    const inserted = result.rowCount || 0;
    total += inserted;
    console.log(`Inserted ${inserted.toLocaleString()} rows in this batch; ${total.toLocaleString()} inserted this run.`);
    if (inserted === 0) break;
  }
  const verify = await pool.query(`
    SELECT
      (SELECT count(*) FROM marketplace_locations WHERE is_active) AS source_rows,
      (SELECT count(*) FROM marketplace_location_search) AS projected_rows,
      (SELECT count(*) FROM marketplace_locations l
       LEFT JOIN marketplace_location_search s ON s.location_id=l.id
       WHERE l.is_active AND s.location_id IS NULL) AS missing_rows
  `);
  console.log('Verification:', verify.rows[0]);
  if (Number(verify.rows[0].missing_rows) > 0) {
    console.error('Backfill incomplete; safe to rerun the script.');
    process.exitCode = 2;
  }
} catch (error) {
  console.error('Location projection backfill failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
