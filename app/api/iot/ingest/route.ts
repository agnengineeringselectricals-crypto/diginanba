import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const readingSchema = z.object({
  meterCode: z.string().trim().min(1).max(100),
  metric: z.string().trim().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/),
  value: z.number().finite().min(-1e15).max(1e15),
  unit: z.string().trim().min(1).max(24),
  timestamp: z.string().datetime({ offset: true }).optional(),
  quality: z.enum(['good','uncertain','bad','estimated']).default('good'),
  messageId: z.string().max(160).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const payloadSchema = z.object({
  siteCode: z.string().trim().min(1).max(80),
  substationCode: z.string().trim().min(1).max(80),
  gatewayCode: z.string().trim().min(1).max(100),
  readings: z.array(readingSchema).min(1).max(500),
}).strict();

function tokenMatches(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.IOT_INGEST_TOKEN;
  if (!expected || expected.length < 32) {
    return NextResponse.json({ error: 'IoT ingestion is not configured.' }, { status: 503 });
  }
  const authorization = request.headers.get('authorization');
  const supplied = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!tokenMatches(supplied, expected)) {
    return NextResponse.json({ error: 'Unauthorized gateway.' }, { status: 401 });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 512_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid telemetry payload.', issues: parsed.error.issues }, { status: 400 });
  }

  const payload = parsed.data;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const siteResult = await client.query(
      'SELECT id FROM iot.sites WHERE site_code=$1',
      [payload.siteCode],
    );
    const siteId = siteResult.rows[0]?.id;
    if (!siteId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Unknown site code. Register the site before ingestion.' }, { status: 404 });
    }
    const substationResult = await client.query(
      'SELECT id FROM iot.substations WHERE site_id=$1 AND substation_code=$2',
      [siteId, payload.substationCode],
    );
    const substationId = substationResult.rows[0]?.id;
    if (!substationId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Unknown substation code. Register the substation before ingestion.' }, { status: 404 });
    }
    const gatewayResult = await client.query(
      `SELECT id FROM iot.gateways WHERE site_id=$1 AND gateway_code=$2 FOR UPDATE`,
      [siteId, payload.gatewayCode],
    );
    const gatewayId = gatewayResult.rows[0]?.id;
    if (!gatewayId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Unknown gateway code. Register the gateway before ingestion.' }, { status: 404 });
    }

    let accepted = 0;
    for (const reading of payload.readings) {
      const meterResult = await client.query(
        'SELECT id FROM iot.meters WHERE site_id=$1 AND substation_id=$2 AND meter_code=$3',
        [siteId, substationId, reading.meterCode],
      );
      const meterId = meterResult.rows[0]?.id;
      if (!meterId) continue;
      await client.query(
        `INSERT INTO iot.measurements
          (site_id,substation_id,meter_id,gateway_id,metric_code,metric_value,unit,quality,measured_at,source_message_id,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [siteId,substationId,meterId,gatewayId,reading.metric,reading.value,reading.unit,reading.quality,
          reading.timestamp || new Date().toISOString(),reading.messageId || null,JSON.stringify(reading.metadata || {})],
      );
      accepted++;
      await client.query(
        `UPDATE iot.meters SET gateway_id=$2,status='online',last_seen_at=now(),updated_at=now() WHERE id=$1`,
        [meterId,gatewayId],
      );
    }
    await client.query(
      `UPDATE iot.gateways SET status='online',last_seen_at=now(),last_error=NULL,updated_at=now() WHERE id=$1`,
      [gatewayId],
    );
    await client.query(
      `INSERT INTO iot.ingestion_events(gateway_id,gateway_code,result,accepted_count,rejected_count,message)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [gatewayId,payload.gatewayCode,accepted === payload.readings.length ? 'accepted' : accepted ? 'accepted' : 'rejected',
        accepted,payload.readings.length-accepted,accepted ? 'Telemetry processed.' : 'No registered meters matched the payload.'],
    );
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, accepted, rejected: payload.readings.length-accepted });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[iot:ingest] telemetry processing failed', error);
    return NextResponse.json({ error: 'Telemetry could not be stored.' }, { status: 500 });
  } finally {
    client.release();
  }
}
