import { NextResponse } from 'next/server';
import { requireProductFactoryAccess } from '@/lib/server/product-factory-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const access = await requireProductFactoryAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const secret = process.env.FACTORY_WORKER_SECRET;
  if (!secret) return NextResponse.json({ error: 'Factory worker is not configured: FACTORY_WORKER_SECRET is missing.' }, { status: 503 });
  try {
    const workerUrl = new URL('/api/internal/product-jobs/process', request.url);
    const body = await request.json().catch(() => ({}));
    const workerBody = body && typeof body.jobId === 'string' && body.jobId.trim()
      ? { jobId: body.jobId.trim() }
      : {};
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(workerBody),
      cache: 'no-store',
      signal: AbortSignal.timeout(55000),
    });
    const payload = await response.json().catch(() => ({ error: 'Worker returned an unreadable response.' }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[admin:factory] worker trigger failed', error);
    return NextResponse.json({ error: 'Unable to reach the factory worker. Check deployment and worker configuration.' }, { status: 502 });
  }
}
