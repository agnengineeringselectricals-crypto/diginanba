#!/usr/bin/env node
/**
 * Import an Osmium GeoJSON Text Sequence into the isolated OSM locality stage.
 *
 * Prerequisites:
 *   - osmium-tool installed (see docs/location-data/OSM_LOCALITY_IMPORT.md)
 *   - NEON_DATABASE_URL set to the DigiNanba Neon database
 *
 * Usage:
 *   node scripts/import_osm_locality_geojsonseq.mjs <input.geojsonseq> [extract-date]
 *
 * Safe to rerun: OSM source_ref (node/way/relation ID) is unique and upserted.
 * This script never writes to marketplace_locations or the live search projection.
 */
import fs from 'node:fs';
import readline from 'node:readline';
import pg from 'pg';

const { Pool } = pg;
const inputPath = process.argv[2];
const extractDate = process.argv[3] || new Date().toISOString().slice(0, 10);
const connectionString = process.env.NEON_DATABASE_URL;

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Usage: node scripts/import_osm_locality_geojsonseq.mjs <input.geojsonseq> [extract-date]');
  process.exit(1);
}
if (!connectionString) {
  console.error('Set NEON_DATABASE_URL before running this importer.');
  process.exit(1);
}

const EXTRACT_URL = 'https://download.geofabrik.de/asia/india-latest.osm.pbf';
const LICENSE = 'ODbL 1.0';
const BATCH_SIZE = 400;

const pool = new Pool({
  connectionString,
  max: 2,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 10000,
  statement_timeout: 120000,
  application_name: 'diginanba-osm-locality-import',
});

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-IN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitNames(value) {
  return String(value || '').split(/[;|]/).map((part) => part.trim()).filter(Boolean);
}

function extractTags(properties) {
  if (properties?.tags && typeof properties.tags === 'object') return properties.tags;
  const tags = { ...(properties || {}) };
  for (const key of ['type', 'id', '@type', '@id', '@version', '@timestamp']) delete tags[key];
  return tags;
}

function identifyOsmObject(properties) {
  const rawType = properties?.['@type'] || properties?.type;
  const rawId = properties?.['@id'] || properties?.id;
  if (typeof rawId === 'string' && /^(node|way|relation)\//.test(rawId)) {
    const [type, id] = rawId.split('/');
    return { type, id: Number(id) };
  }
  if (['node', 'way', 'relation'].includes(rawType) && Number.isFinite(Number(rawId))) {
    return { type: rawType, id: Number(rawId) };
  }
  return null;
}

function flattenCoordinates(value, points = []) {
  if (!Array.isArray(value)) return points;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    points.push([value[0], value[1]]);
    return points;
  }
  for (const child of value) flattenCoordinates(child, points);
  return points;
}

function representativePoint(geometry) {
  if (!geometry?.coordinates) return null;
  if (geometry.type === 'Point') {
    const [longitude, latitude] = geometry.coordinates;
    return Number.isFinite(longitude) && Number.isFinite(latitude) ? { longitude, latitude } : null;
  }
  const points = flattenCoordinates(geometry.coordinates);
  if (!points.length) return null;
  // For long lines and polygons this is a lightweight representative point.
  // It is used for autocomplete/map pins, not as a legal boundary centroid.
  const longitude = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const latitude = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { longitude, latitude };
}

function classify(tags) {
  const place = String(tags.place || '').toLowerCase();
  const highway = String(tags.highway || '').toLowerCase();
  const placeTypes = {
    city: 'city',
    town: 'town',
    village: 'village',
    hamlet: 'hamlet',
    isolated_dwelling: 'hamlet',
    neighbourhood: 'neighbourhood',
    suburb: 'suburb',
    quarter: 'locality',
    locality: 'locality',
    borough: 'locality',
  };
  if (placeTypes[place]) {
    return { locationType: placeTypes[place], placeType: place, highwayClass: null };
  }
  if (highway && (tags.name || tags['name:en'] || tags.loc_name)) {
    const streetClasses = new Set(['residential', 'living_street', 'pedestrian', 'service']);
    return {
      locationType: streetClasses.has(highway) ? 'street' : 'road',
      placeType: null,
      highwayClass: highway,
    };
  }
  return null;
}

function buildRecord(feature) {
  const properties = feature?.properties || {};
  const object = identifyOsmObject(properties);
  if (!object || !Number.isSafeInteger(object.id) || object.id <= 0) return null;

  const tags = extractTags(properties);
  const classification = classify(tags);
  if (!classification) return null;

  const name = String(tags.name || tags['name:en'] || tags.loc_name || tags.official_name || '').trim();
  if (!name) return null;
  const point = representativePoint(feature.geometry);
  if (!point) return null;

  const aliases = new Set();
  for (const [key, value] of Object.entries(tags)) {
    if (key === 'name' || key === 'official_name' || key === 'short_name' ||
        key === 'alt_name' || key === 'loc_name' || key === 'old_name' ||
        key.startsWith('name:')) {
      for (const candidate of splitNames(value)) {
        if (candidate && normalize(candidate) !== normalize(name)) aliases.add(candidate);
      }
    }
  }

  return {
    sourceRef: object.type + '/' + object.id,
    osmType: object.type,
    osmId: object.id,
    name,
    normalizedName: normalize(name),
    aliases: [...aliases].slice(0, 40),
    locationType: classification.locationType,
    placeType: classification.placeType,
    highwayClass: classification.highwayClass,
    stateHint: tags['addr:state'] || tags['is_in:state'] || tags['addr:province'] || null,
    districtHint: tags['addr:district'] || tags['is_in:district'] || null,
    subdistrictHint: tags['addr:subdistrict'] || tags['is_in:subdistrict'] || tags['addr:county'] || null,
    parentHint: tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['is_in'] || null,
    postalCode: tags['addr:postcode'] || tags.postal_code || null,
    latitude: point.latitude,
    longitude: point.longitude,
    tags,
  };
}

async function insertBatch(batchId, rows) {
  if (!rows.length) return 0;
  const values = [];
  const tuples = rows.map((row, index) => {
    const offset = index * 18;
    values.push(
      batchId, row.sourceRef, row.osmType, row.osmId, row.name, row.normalizedName,
      row.aliases, row.locationType, row.placeType, row.highwayClass, row.stateHint,
      row.districtHint, row.subdistrictHint, row.parentHint, row.postalCode,
      row.latitude, row.longitude, JSON.stringify(row.tags)
    );
    return `($${offset + 1}::uuid,$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7}::text[],$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12},$${offset + 13},$${offset + 14},$${offset + 15},$${offset + 16},$${offset + 17},$${offset + 18}::jsonb,ST_SetSRID(ST_MakePoint($${offset + 17},$${offset + 16}),4326)::geography,'ODbL 1.0','pending',now())`;
  });
  const result = await pool.query(`
    INSERT INTO marketplace_locality_import_stage (
      import_batch_id,source_ref,osm_type,osm_id,name,normalized_name,aliases,
      location_type,osm_place_type,highway_class,state_hint,district_hint,
      subdistrict_hint,parent_hint,postal_code,latitude,longitude,raw_tags,
      geom,source_license,review_status,imported_at
    )
    VALUES ${tuples.join(',')}
    ON CONFLICT (source_ref) DO UPDATE SET
      import_batch_id=EXCLUDED.import_batch_id,
      name=EXCLUDED.name,
      normalized_name=EXCLUDED.normalized_name,
      aliases=EXCLUDED.aliases,
      location_type=EXCLUDED.location_type,
      osm_place_type=EXCLUDED.osm_place_type,
      highway_class=EXCLUDED.highway_class,
      state_hint=EXCLUDED.state_hint,
      district_hint=EXCLUDED.district_hint,
      subdistrict_hint=EXCLUDED.subdistrict_hint,
      parent_hint=EXCLUDED.parent_hint,
      postal_code=EXCLUDED.postal_code,
      latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude,
      raw_tags=EXCLUDED.raw_tags,
      geom=EXCLUDED.geom,
      source_license=EXCLUDED.source_license,
      imported_at=now()
  `, values);
  return result.rowCount || 0;
}

let batchId;
let inputFeatures = 0;
let importedFeatures = 0;
let rejectedFeatures = 0;
let pending = [];

try {
  const batch = await pool.query(`
    INSERT INTO marketplace_locality_import_batches
      (extract_url,extract_date,status,started_at)
    VALUES ($1,$2::date,'running',now())
    RETURNING id
  `, [EXTRACT_URL, extractDate]);
  batchId = batch.rows[0].id;

  const lines = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of lines) {
    const line = rawLine.replace(/^\u001e/, '').trim();
    if (!line) continue;
    inputFeatures += 1;
    let feature;
    try {
      feature = JSON.parse(line);
    } catch {
      rejectedFeatures += 1;
      continue;
    }
    const record = buildRecord(feature);
    if (!record) {
      rejectedFeatures += 1;
      continue;
    }
    pending.push(record);
    if (pending.length >= BATCH_SIZE) {
      importedFeatures += await insertBatch(batchId, pending);
      pending = [];
      if (inputFeatures % 10000 === 0) {
        console.log(`Read ${inputFeatures.toLocaleString()} features; imported ${importedFeatures.toLocaleString()} locality records.`);
      }
    }
  }
  if (pending.length) importedFeatures += await insertBatch(batchId, pending);

  await pool.query(`
    UPDATE marketplace_locality_import_batches
    SET status='completed',input_features=$2,imported_features=$3,
        rejected_features=$4,completed_at=now()
    WHERE id=$1
  `, [batchId, inputFeatures, importedFeatures, rejectedFeatures]);

  console.log(JSON.stringify({
    batchId, inputFeatures, importedFeatures, rejectedFeatures, status: 'completed',
  }, null, 2));
} catch (error) {
  if (batchId) {
    await pool.query(`
      UPDATE marketplace_locality_import_batches
      SET status='failed',input_features=$2,imported_features=$3,
          rejected_features=$4,error_summary=$5,completed_at=now()
      WHERE id=$1
    `, [batchId, inputFeatures, importedFeatures, rejectedFeatures, String(error?.message || error).slice(0, 2000)]).catch(() => {});
  }
  console.error('OSM locality import failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
