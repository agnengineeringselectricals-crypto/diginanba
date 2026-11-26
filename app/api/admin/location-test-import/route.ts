import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EXPECTED_ROWS = 17379;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const HEADERS = [
  'source_object_id','state_name','state_lgd_code','district_name','district_lgd_code',
  'subdistrict_name','subdistrict_lgd_code','subdistrict_type','village_name',
  'village_name_normalized','village_category','village_lgd_code','shape_length','shape_area',
];

async function getImportAccess() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, status: 401, error: 'Authentication required.' };
  const result = await db.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'Super Admin' LIMIT 1`,
    [userId],
  );
  if (!result.rowCount) return { ok: false as const, status: 403, error: 'Super Admin access is required for this import.' };
  return { ok: true as const, userId };
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) throw new Error('CSV contains an invalid numeric geometry value.');
  return value.trim();
}

export async function POST(request: Request) {
  const access = await getImportAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Cross-origin upload rejected.' }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose the Tamil Nadu CSV file first.' }, { status: 400 });
    if (file.size < 1 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'CSV must be between 1 byte and 8 MB.' }, { status: 413 });
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only a .csv file is accepted.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
    const rows = parseCsv(csv);
    if (rows.length !== EXPECTED_ROWS + 1) {
      return NextResponse.json({ error: `Expected exactly ${EXPECTED_ROWS.toLocaleString('en-IN')} data rows plus one header row; received ${Math.max(0, rows.length - 1).toLocaleString('en-IN')} data rows.` }, { status: 400 });
    }
    if (rows[0].length !== HEADERS.length || HEADERS.some((header, index) => rows[0][index]?.trim() !== header)) {
      return NextResponse.json({ error: 'CSV headers do not match the approved Tamil Nadu staging format.' }, { status: 400 });
    }

    const records = rows.slice(1).map((values, index) => {
      if (values.length !== HEADERS.length) throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected ${HEADERS.length}.`);
      const [sourceId,stateName,stateCode,district,districtCode,subdistrict,subdistrictCode,subdistrictType,village,villageNormalized,category,villageCode,shapeLength,shapeArea] = values;
      if (!stateName.trim() || !district.trim() || !subdistrict.trim() || !village.trim() || !villageNormalized.trim()) {
        throw new Error(`CSV row ${index + 2} is missing a required place name.`);
      }
      return [
        sourceId || null, stateName, stateCode || null, district, districtCode || null,
        subdistrict, subdistrictCode || null, subdistrictType || null, village,
        villageNormalized, category || null, villageCode || null,
        nullableNumber(shapeLength), nullableNumber(shapeArea),
      ];
    });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('diginanba:tamilnadu-official-villages-import'))");
      const existing = await client.query('SELECT COUNT(*)::int AS count FROM location_test.tamilnadu_official_villages');
      if (Number(existing.rows[0]?.count ?? 0) !== 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'The staging table is not empty. Import stopped to prevent duplicate or overwritten data.' }, { status: 409 });
      }

      const columns = [
        'source_object_id','state_name','state_lgd_code','district_name','district_lgd_code',
        'subdistrict_name','subdistrict_lgd_code','subdistrict_type','village_name',
        'village_name_normalized','village_category','village_lgd_code','shape_length','shape_area',
      ];
      const batchSize = 250;
      for (let offset = 0; offset < records.length; offset += batchSize) {
        const batch = records.slice(offset, offset + batchSize);
        const params: unknown[] = [];
        const tuples = batch.map((record) => {
          const placeholders = record.map((value) => {
            params.push(value);
            return `$${params.length}`;
          });
          return `(${placeholders.join(',')})`;
        });
        await client.query(
          `INSERT INTO location_test.tamilnadu_official_villages (${columns.join(',')}) VALUES ${tuples.join(',')}`,
          params,
        );
      }
      const verified = await client.query('SELECT COUNT(*)::int AS count FROM location_test.tamilnadu_official_villages');
      const imported = Number(verified.rows[0]?.count ?? 0);
      if (imported !== EXPECTED_ROWS) throw new Error(`Post-import verification failed: expected ${EXPECTED_ROWS}, found ${imported}.`);
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, imported, table: 'location_test.tamilnadu_official_villages' });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[admin:location-test-import] import failed', error);
    const message = error instanceof Error ? error.message : 'Import failed unexpectedly.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
