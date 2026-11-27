#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { parse } from 'csv-parse';

const { Pool } = pg;
const inputDir = process.argv[2];
const csvPath = path.join(inputDir || '', 'lgd_villages_all_states.csv');
const connectionString = process.env.NEON_DATABASE_URL;
if (!inputDir || !fs.existsSync(csvPath)) throw new Error('Missing LGD package directory or village CSV.');
if (!connectionString) throw new Error('NEON_DATABASE_URL is required.');

const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 20000, application_name: 'diginanba-tn-lgd-reconciliation-stage' });
const client = await pool.connect();
const insertBatch = async (batch) => {
  if (!batch.length) return;
  const values = [];
  const tuples = batch.map((r, i) => {
    const n = i * 17;
    values.push(r.village_code,r.state_code,r.state_name,r.district_code,r.district_name_en,r.subdistrict_code,r.subdistrict_name_en,r.village_version,r.village_name_en,r.village_name_local || null,r.village_status || null,r.census_2001_code || null,r.census_2011_code || null,r.remark || null,r.source_zip || null,'lgd_villages_all_states.csv',r.__sourceRow);
    return `($${n+1},$${n+2},$${n+3},$${n+4},$${n+5},$${n+6},$${n+7},$${n+8},$${n+9},$${n+10},$${n+11},$${n+12},$${n+13},$${n+14},$${n+15},$${n+16},$${n+17})`;
  });
  await client.query(`
    INSERT INTO location_test.india_lgd_tamilnadu_villages_reconciliation (
      village_lgd_code,state_lgd_code,state_name,district_lgd_code,district_name_en,
      subdistrict_lgd_code,subdistrict_name_en,village_version,village_name_en,
      village_name_local,village_status,census_2001_code,census_2011_code,remark,
      source_zip,source_file,source_row
    ) VALUES ${tuples.join(',')}
    ON CONFLICT (village_lgd_code) DO UPDATE SET
      state_lgd_code=EXCLUDED.state_lgd_code,state_name=EXCLUDED.state_name,
      district_lgd_code=EXCLUDED.district_lgd_code,district_name_en=EXCLUDED.district_name_en,
      subdistrict_lgd_code=EXCLUDED.subdistrict_lgd_code,subdistrict_name_en=EXCLUDED.subdistrict_name_en,
      village_version=EXCLUDED.village_version,village_name_en=EXCLUDED.village_name_en,
      village_name_local=EXCLUDED.village_name_local,village_status=EXCLUDED.village_status,
      census_2001_code=EXCLUDED.census_2001_code,census_2011_code=EXCLUDED.census_2011_code,
      remark=EXCLUDED.remark,source_zip=EXCLUDED.source_zip,source_file=EXCLUDED.source_file,
      source_row=EXCLUDED.source_row,loaded_at=now()
  `, values);
};

try {
  await client.query('SET statement_timeout = 0');
  await client.query(`
    CREATE TABLE IF NOT EXISTS location_test.india_lgd_tamilnadu_villages_reconciliation (
      village_lgd_code text PRIMARY KEY,
      state_lgd_code text NOT NULL,
      state_name text NOT NULL,
      district_lgd_code text NOT NULL,
      district_name_en text NOT NULL,
      subdistrict_lgd_code text NOT NULL,
      subdistrict_name_en text NOT NULL,
      village_version text,
      village_name_en text NOT NULL,
      village_name_local text,
      village_status text,
      census_2001_code text,
      census_2011_code text,
      remark text,
      source_zip text,
      source_file text NOT NULL,
      source_row integer NOT NULL,
      loaded_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query('BEGIN');
  const seen = new Set();
  let batch = [];
  let tnCount = 0;
  let sourceRow = 1;
  for await (const r of fs.createReadStream(csvPath).pipe(parse({ columns: true, bom: true, skip_empty_lines: true }))) {
    sourceRow++;
    if (r.state_code !== '33' || r.state_name !== 'Tamil Nadu') continue;
    if (!r.village_code || seen.has(r.village_code)) throw new Error('Missing or duplicate Tamil Nadu village LGD code: ' + r.village_code);
    seen.add(r.village_code);
    if (!r.district_code || !r.subdistrict_code || !r.village_name_en) throw new Error('Missing required hierarchy/name fields for village code ' + r.village_code);
    batch.push({ ...r, __sourceRow: sourceRow });
    tnCount++;
    if (batch.length >= 500) {
      await insertBatch(batch);
      batch = [];
    }
  }
  if (batch.length) await insertBatch(batch);
  if (tnCount !== 18681) throw new Error(`Expected 18,681 Tamil Nadu rows; found ${tnCount}. Refusing to commit.`);
  await client.query('COMMIT');
  const result = await client.query('SELECT count(*)::int AS rows, count(DISTINCT village_lgd_code)::int AS distinct_codes FROM location_test.india_lgd_tamilnadu_villages_reconciliation');
  console.log(JSON.stringify({ status: 'loaded', sourceRows: tnCount, staged: result.rows[0] }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
