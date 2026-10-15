import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireProductFactoryAccess } from '@/lib/server/product-factory-access';

export const runtime = 'nodejs';

const testSchema = z.object({
  checks: z.object({
    deliverableGenerated: z.literal(true),
    openedInTargetApp: z.literal(true),
    formulasAndImportChecked: z.literal(true),
    visualAccessibilityChecked: z.literal(true),
    localizationAndMarketChecked: z.literal(true),
    sampleDataAndInstructionsChecked: z.literal(true),
  }),
  notes: z.string().trim().min(20).max(4000),
});

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const access = await requireProductFactoryAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { jobId } = await context.params;
  if (!z.string().uuid().safeParse(jobId).success) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
  }
  const parsed = testSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'All artifact test checks and a meaningful test note are required.', issues: parsed.error.issues }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      'SELECT id, status, result_json FROM product_factory_jobs WHERE id=$1 FOR UPDATE',
      [jobId],
    );
    const job = found.rows[0];
    if (!job) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.status !== 'quality_review') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Artifact tests can only be recorded for a draft in quality_review status.' }, { status: 409 });
    }
    const current = job.result_json && typeof job.result_json === 'object' ? job.result_json : {};
    const actualArtifactTests = {
      status: 'passed',
      checks: parsed.data.checks,
      notes: parsed.data.notes,
      recordedBy: access.userId,
      recordedAt: new Date().toISOString(),
      method: 'admin_attested_manual_checklist',
    };
    const nextResult = { ...current, actualArtifactTests, publicationStatus: 'awaiting_human_approval' };
    await client.query('UPDATE product_factory_jobs SET result_json=$2::jsonb, updated_at=now() WHERE id=$1', [jobId, JSON.stringify(nextResult)]);
    await client.query(
      `INSERT INTO product_factory_job_events(job_id, actor_user_id, from_status, to_status, event_type, details_json)
       VALUES ($1, $2, 'quality_review', 'quality_review', 'artifact_tests_recorded', $3::jsonb)`,
      [jobId, access.userId, JSON.stringify({ checks: parsed.data.checks, notes: parsed.data.notes })],
    );
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, actualArtifactTests, message: 'Artifact test checklist recorded. The draft still requires your explicit approval and is not published.' });
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ error: 'Unable to record artifact tests.' }, { status: 503 });
  } finally {
    client.release();
  }
}
