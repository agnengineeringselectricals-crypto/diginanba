import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeDatabaseError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;

  // Return only a stable PostgreSQL/network error code, never the connection string
  // or raw driver message, which can contain infrastructure details.
  if (code && /^[A-Z0-9]{2,10}$/.test(code)) return code;

  const message = error instanceof Error ? error.message : '';
  if (/DATABASE_URL/i.test(message)) return 'DATABASE_CONFIG';
  if (/timeout|timed out/i.test(message)) return 'DB_TIMEOUT';
  if (/connection refused/i.test(message)) return 'ECONNREFUSED';
  if (/ENOTFOUND|getaddrinfo/i.test(message)) return 'DNS_LOOKUP';
  if (/password authentication failed/i.test(message)) return 'AUTH_FAILED';
  if (/does not exist/i.test(message)) return 'DB_OBJECT_MISSING';
  return 'DB_CONNECT_FAILED';
}

export async function GET() {
  try {
    await db.query('SELECT 1');
    return NextResponse.json({
      ok: true,
      service: 'diginanba-web',
      database: 'connected',
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'diginanba-web',
        database: 'unavailable',
        diagnostic: safeDatabaseError(error),
      },
      { status: 503 },
    );
  }
}
