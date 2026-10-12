import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireFactoryManager } from '@/lib/server/ai-factory-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const jobTypes = [
  'market_research',
  'product_outline',
  'product_draft',
  'localization',
  'quality_review',
] as const;

const createJobSchema = z.object({
  jobType: z.enum(jobTypes),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  input: z.record(z.string(), z.unknown()).default({}),
}).strict();

function containsSensitiveKey(value: unknown, depth = 0): boolean {
  if (depth > 12) return true;
  if (Array.isArray(value)) return value.some(item => containsSensitiveKey(item, depth + 1));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) =>
    /(?:api.?key|secret|password|credential|authorization|access.?token|refresh.?token|private.?key)/i.test(key)
    || containsSensitiveKey(nested, depth + 1),
  );
}

const allowedStatuses = new Set([
  'queued', 'running', 'needs_review', 'completed', 'failed', 'cancelled',
]);

export async function GET(request: Request) {
  const access = await requireFactoryManager();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limitRaw = Number(url.searchParams.get('limit') ?? '25');
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 25;

  if (status && !allowedStatuses.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  try {
    const result = status
      ? await db.query(
          `SELECT id, job_type, status, attempts, max_attempts, error_code,
                  created_at, updated_at, started_at, completed_at
             FROM ai_factory_jobs
            WHERE status = $1
            ORDER BY created_at DESC
            LIMIT $2`,
          [status, limit],
        )
      : await db.query(
          `SELECT id, job_type, status, attempts, max_attempts, error_code,
                  created_at, updated_at, started_at, completed_at
             FROM ai_factory_jobs
            ORDER BY created_at DESC
            LIMIT $1`,
          [limit],
        );

    return NextResponse.json({ jobs: result.rows });
  } catch (error) {
    console.error('AI factory jobs list failed', error);
    return NextResponse.json(
      { error: 'AI factory storage is not available. Confirm the reviewed migration has been applied.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const access = await requireFactoryManager();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = createJobSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid job request', issues: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) },
      { status: 400 },
    );
  }

  // Keep queued input bounded; never accept API credentials or executable instructions as config.
  if (containsSensitiveKey(parsed.data.input)) {
    return NextResponse.json({ error: 'Job input must not contain secrets, credentials, or token fields' }, { status: 400 });
  }
  const inputText = JSON.stringify(parsed.data.input);
  if (Buffer.byteLength(inputText, 'utf8') > 32_000) {
    return NextResponse.json({ error: 'Job input exceeds the 32 KB limit' }, { status: 413 });
  }

  try {
    const result = await db.query(
      `INSERT INTO ai_factory_jobs (job_type, idempotency_key, input, requested_by)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, job_type, status, attempts, max_attempts, created_at`,
      [parsed.data.jobType, parsed.data.idempotencyKey, inputText, access.userId],
    );

    if (result.rowCount) {
      try {
        await db.query(
          `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, after_json)
           VALUES ($1, 'ai_factory.job_queued', 'ai_factory_job', $2, $3::jsonb)`,
          [access.userId, result.rows[0].id, JSON.stringify({ jobType: parsed.data.jobType })],
        );
      } catch (auditError) {
        // Do not report enqueue failure after the queue insert has already succeeded.
        console.error('AI factory enqueue audit record failed', auditError);
      }
      return NextResponse.json({ job: result.rows[0], deduplicated: false }, { status: 201 });
    }

    const existing = await db.query(
      `SELECT id, job_type, status, attempts, max_attempts, created_at
         FROM ai_factory_jobs WHERE idempotency_key = $1 LIMIT 1`,
      [parsed.data.idempotencyKey],
    );

    const existingJob = existing.rows[0];
    if (!existingJob) {
      return NextResponse.json({ error: 'Idempotency conflict; retry with a new key' }, { status: 409 });
    }
    if (existingJob.job_type !== parsed.data.jobType) {
      return NextResponse.json({ error: 'Idempotency key is already used by a different job type' }, { status: 409 });
    }
    return NextResponse.json({ job: existingJob, deduplicated: true }, { status: 200 });
  } catch (error) {
    console.error('AI factory job enqueue failed', error);
    return NextResponse.json(
      { error: 'AI factory storage is not available. Confirm the reviewed migration has been applied.' },
      { status: 503 },
    );
  }
}
