import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireProductFactoryAccess } from '@/lib/server/product-factory-access';
import { productJobStatuses, transitionProductFactoryJob } from '@/lib/server/product-factory';

const updateSchema = z.object({
  status: z.enum(productJobStatuses),
  details: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(4000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const access = await requireProductFactoryAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { jobId } = await context.params;
  if (!z.string().uuid().safeParse(jobId).success) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid job update', issues: parsed.error.issues }, { status: 400 });
  try {
    const job = await transitionProductFactoryJob(
      jobId,
      parsed.data.status,
      access.userId,
      parsed.data.details ?? {},
      parsed.data.error,
    );
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update job';
    const status = message === 'Job not found' ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
