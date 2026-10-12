import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFactoryManager } from '@/lib/server/ai-factory-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await requireFactoryManager();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid review status' }, { status: 400 });
  }
  const rawLimit = Number(url.searchParams.get('limit') ?? '25');
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 25;

  try {
    const result = await db.query(
      `SELECT d.id, d.job_id, d.product_id, d.draft, d.review_status,
              d.reviewed_by, d.reviewed_at, d.created_at,
              j.job_type, j.status AS job_status
         FROM ai_factory_drafts d
         JOIN ai_factory_jobs j ON j.id = d.job_id
        WHERE d.review_status = $1
        ORDER BY d.created_at ASC
        LIMIT $2`,
      [status, limit],
    );
    return NextResponse.json({ drafts: result.rows });
  } catch (error) {
    console.error('AI factory drafts list failed', error);
    return NextResponse.json(
      { error: 'AI factory storage is not available. Confirm the reviewed migration has been applied.' },
      { status: 503 },
    );
  }
}
