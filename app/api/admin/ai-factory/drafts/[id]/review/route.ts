import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireFactoryManager } from '@/lib/server/ai-factory-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const access = await requireFactoryManager();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid review decision' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const draftResult = await client.query(
      `SELECT id, job_id, review_status
         FROM ai_factory_drafts
        WHERE id = $1
        FOR UPDATE`,
      [id],
    );
    const draft = draftResult.rows[0];
    if (!draft) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    if (draft.review_status !== 'pending') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Draft has already been reviewed' }, { status: 409 });
    }

    const status = parsed.data.decision === 'approve' ? 'approved' : 'rejected';
    const jobStatus = parsed.data.decision === 'approve' ? 'completed' : 'cancelled';
    await client.query(
      `UPDATE ai_factory_drafts
          SET review_status = $2, reviewed_by = $3, reviewed_at = now()
        WHERE id = $1`,
      [id, status, access.userId],
    );
    await client.query(
      `UPDATE ai_factory_jobs
          SET status = $2, updated_at = now(), completed_at = now()
        WHERE id = $1 AND status = 'needs_review'`,
      [draft.job_id, jobStatus],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, after_json)
       VALUES ($1, 'ai_factory.draft_reviewed', 'ai_factory_draft', $2, $3::jsonb)`,
      [access.userId, id, JSON.stringify({ decision: parsed.data.decision, note: parsed.data.note ?? null })],
    );
    await client.query('COMMIT');
    return NextResponse.json({ reviewed: true, draftId: id, reviewStatus: status, jobStatus, published: false });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('AI factory draft review failed', error);
    return NextResponse.json({ error: 'Draft review could not be saved' }, { status: 500 });
  } finally {
    client.release();
  }
}
