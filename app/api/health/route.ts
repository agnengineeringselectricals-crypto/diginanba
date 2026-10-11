import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeDatabaseDiagnostic(error: unknown) {
  const item = typeof error === 'object' && error !== null
    ? error as { code?: unknown; syscall?: unknown; message?: unknown }
    : {};
  const code = typeof item.code === 'string' ? item.code : '';
  const syscall = typeof item.syscall === 'string' && /^[a-z_]{2,20}$/i.test(item.syscall)
    ? item.syscall
    : undefined;

  // Never return raw driver messages, file paths, hostnames, or credentials.
  if (code === 'ENOENT') {
    return { code: 'ENOENT', cause: syscall ? `MISSING_PATH_${syscall.toUpperCase()}` : 'MISSING_PATH' };
  }
  if (code && /^[A-Z0-9]{2,10}$/.test(code)) return { code, ...(syscall ? { syscall } : {}) };

  const message = typeof item.message === 'string' ? item.message : '';
  if (/DATABASE_URL/i.test(message)) return { code: 'DATABASE_CONFIG' };
  if (/timeout|timed out/i.test(message)) return { code: 'DB_TIMEOUT' };
  if (/connection refused/i.test(message)) return { code: 'ECONNREFUSED' };
  if (/ENOTFOUND|getaddrinfo/i.test(message)) return { code: 'DNS_LOOKUP' };
  if (/password authentication failed/i.test(message)) return { code: 'AUTH_FAILED' };
  if (/does not exist/i.test(message)) return { code: 'DB_OBJECT_MISSING' };
  return { code: 'DB_CONNECT_FAILED' };
}

function safeConnectionConfig() {
  const value = process.env.DATABASE_URL;
  if (!value) return { configured: false, format: 'missing' };

  try {
    const parsed = new URL(value);
    return {
      configured: true,
      format: parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:' ? 'postgres-url' : 'unexpected-url-scheme',
      hostnamePresent: Boolean(parsed.hostname),
      socketPathConfigured: parsed.searchParams.has('host') && parsed.searchParams.get('host')?.startsWith('/') === true,
    };
  } catch {
    // Do not expose or log the value; it contains credentials.
    return { configured: true, format: 'unparseable-url' };
  }
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
        diagnostic: safeDatabaseDiagnostic(error),
        connectionConfig: safeConnectionConfig(),
      },
      { status: 503 },
    );
  }
}
