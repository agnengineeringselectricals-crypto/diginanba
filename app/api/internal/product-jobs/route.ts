import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProductFactoryAccess } from '@/lib/server/product-factory-access';
import { createProductFactoryJob, listProductFactoryJobs, productJobTypes } from '@/lib/server/product-factory';

const createSchema = z.object({
  jobType: z.enum(productJobTypes),
  marketCode: z.enum(['IN', 'US', 'UK']).optional(),
  locale: z.string().min(2).max(35).optional(),
  categoryId: z.string().uuid().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

export async function GET(request: Request) {
  const access = await requireProductFactoryAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || 25);
    return NextResponse.json({ jobs: await listProductFactoryJobs(Number.isFinite(limit) ? limit : 25) });
  } catch {
    return NextResponse.json({ error: 'Unable to load internal jobs. Confirm the Stage 7 database migration has been applied.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await requireProductFactoryAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid job input', issues: parsed.error.issues }, { status: 400 });
  try {
    const job = await createProductFactoryJob(parsed.data, access.userId);
    return NextResponse.json({ job }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to queue job. Confirm the Stage 7 database migration has been applied and the selected category exists.' }, { status: 503 });
  }
}
