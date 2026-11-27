import pg from "pg";
import { parse } from "csv-parse";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

const connectionString = process.env.NEON_DATABASE_URL;
const file = process.argv[2];
if (!connectionString || !file) throw new Error("NEON_DATABASE_URL and CSV path are required");

const pool = new pg.Pool({ connectionString, max: 2, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
let count = 0;
let batch = [];
const normalize = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

try {
  await client.query("BEGIN");
  await client.query(`CREATE TABLE IF NOT EXISTS location_test.india_postal_offices (
    id BIGSERIAL PRIMARY KEY, circle_name TEXT, region_name TEXT, division_name TEXT,
    office_name TEXT NOT NULL, office_name_normalized TEXT NOT NULL,
    pincode TEXT NOT NULL CHECK (pincode ~ '^[0-9]{6}$'),
    office_type TEXT, delivery_status TEXT, district_name TEXT NOT NULL, state_name TEXT NOT NULL,
    latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
    source_name TEXT NOT NULL DEFAULT 'Department of Posts, Government of India',
    source_url TEXT NOT NULL DEFAULT 'https://data.gov.in/catalog/all-india-pincode-directory-through-webservice',
    source_release TEXT, imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pincode, office_name, district_name, state_name)
  )`);
  await client.query("CREATE INDEX IF NOT EXISTS india_postal_offices_pincode_idx ON location_test.india_postal_offices (pincode)");
  await client.query("CREATE INDEX IF NOT EXISTS india_postal_offices_pincode_prefix_idx ON location_test.india_postal_offices (pincode text_pattern_ops)");
  await client.query("CREATE INDEX IF NOT EXISTS india_postal_offices_name_prefix_idx ON location_test.india_postal_offices (office_name_normalized text_pattern_ops)");
  await client.query("CREATE INDEX IF NOT EXISTS india_postal_offices_state_district_idx ON location_test.india_postal_offices (state_name, district_name)");
  await client.query("COMMIT");

  const parser = createReadStream(file).pipe(parse({ columns: true, bom: true, skip_empty_lines: true, relax_quotes: true, trim: true }));
  for await (const row of parser) {
    const get = (...keys) => {
      for (const key of keys) if (row[key] !== undefined) return String(row[key] ?? "").trim();
      return "";
    };
    const office = get("OfficeName", "officename", "office_name");
    const pin = get("Pincode", "pincode", "PINCODE");
    const district = get("District", "district", "district_name");
    const state = get("StateName", "statename", "state_name");
    if (!office || !/^\d{6}$/.test(pin) || !district || !state) continue;
    const number = (v) => v && v.toLowerCase() !== "na" && Number.isFinite(Number(v)) ? Number(v) : null;
    batch.push([
      get("CircleName","circlename"), get("RegionName","regionname"), get("DivisionName","divisionname"),
      office, normalize(office), pin, get("OfficeType","officetype"), get("Delivery","delivery"),
      district, state, number(get("Latitude","latitude")), number(get("Longitude","longitude")),
      "India Post All India Pincode Directory", "https://data.gov.in/catalog/all-india-pincode-directory-through-webservice",
      "source-snapshot-import"
    ]);
    if (batch.length >= 500) {
      await insertBatch(client, batch); count += batch.length; batch = [];
      if (count % 10000 === 0) console.log(`Imported ${count} valid post-office rows`);
    }
  }
  if (batch.length) { await insertBatch(client, batch); count += batch.length; }
  const summary = await client.query(`SELECT count(*)::int AS rows, count(DISTINCT pincode)::int AS pincodes,
    count(DISTINCT state_name)::int AS states FROM location_test.india_postal_offices`);
  console.log(JSON.stringify({ imported_rows: count, totals: summary.rows[0] }));
} finally {
  client.release();
  await pool.end();
}

async function insertBatch(client, rows) {
  const values = [];
  const tuples = rows.map((row, i) => {
    const offset = i * 15;
    values.push(...row);
    return `(${Array.from({length:15},(_,j)=>"$"+(offset+j+1)).join(",")})`;
  });
  await client.query(`
    INSERT INTO location_test.india_postal_offices
    (circle_name,region_name,division_name,office_name,office_name_normalized,pincode,office_type,delivery_status,district_name,state_name,latitude,longitude,source_name,source_url,source_release)
    VALUES ${tuples.join(",")}
    ON CONFLICT (pincode,office_name,district_name,state_name) DO UPDATE SET
      circle_name=EXCLUDED.circle_name, region_name=EXCLUDED.region_name, division_name=EXCLUDED.division_name,
      office_type=EXCLUDED.office_type, delivery_status=EXCLUDED.delivery_status,
      latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, source_release=EXCLUDED.source_release, imported_at=now()
  `, values);
}
