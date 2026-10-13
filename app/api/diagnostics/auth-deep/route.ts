import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeError(error: unknown) {
  const e = error instanceof Error ? error : new Error(String(error));
  // Return useful exception details without exposing connection strings or common secret formats.
  const redact = (value: string) => value
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(secret|password|token|client_secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
  return {
    name: e.name,
    message: redact(e.message).slice(0, 1200),
    stack: e.stack ? redact(e.stack).slice(0, 5000) : null,
    cause: e.cause instanceof Error
      ? { name: e.cause.name, message: redact(e.cause.message).slice(0, 1200) }
      : undefined,
  };
}

export async function GET() {
  // This diagnostic intentionally runs only on Vercel Preview/local deployments.
  // Never expose runtime exception details from Production.
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const report: Record<string, unknown> = {
    service: 'diginanba-auth-deep-diagnostic',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    timestamp: new Date().toISOString(),
    environmentPresence: {
      AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
      NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
      AUTH_URL: Boolean(process.env.AUTH_URL),
      NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL),
      AUTH_REDIRECT_PROXY_URL: Boolean(process.env.AUTH_REDIRECT_PROXY_URL),
      GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
    },
  };

  try {
    await import('@/lib/auth');
    report.authModuleImport = { ok: true };
  } catch (error) {
    report.authModuleImport = { ok: false, error: safeError(error) };
  }

  try {
    const { db } = await import('@/lib/db');
    const result = await db.query('SELECT 1 AS diagnostic_ok');
    report.database = { ok: result.rows?.[0]?.diagnostic_ok === 1 || result.rows?.[0]?.diagnostic_ok === '1' };
  } catch (error) {
    report.database = { ok: false, error: safeError(error) };
  }

  return NextResponse.json(report, {
    status: 200,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
