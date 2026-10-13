import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { generateFactoryOutput, type FactoryJob } from '@/lib/server/ai-factory-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = process.env.FACTORY_WORKER_SECRET;
  if (!expected || expected.length < 32) return false;
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) return false;
  const supplied = match[1];
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(supplied, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function processOne(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI provider is not configured' }, { status: 503 });
  }

  const client = await db.connect();
  let job: FactoryJob | undefined;
  try {
    await client.query('BEGIN');
    const claimed = await client.query(
      `SELECT id, job_type, input, attempts, max_attempts
         FROM ai_factory_jobs
        WHERE status = 'queued' AND attempts < max_attempts
        ORDER BY created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
    );
    if (!claimed.rowCount) {
      await client.query('COMMIT');
      return NextResponse.json({ processed: false, reason: 'queue_empty' });
    }
    const row = claimed.rows[0];
    job = {
      id: String(row.id),
      job_type: row.job_type,
      input: row.input && typeof row.input === 'object' ? row.input : {},
      attempts: Number(row.attempts) + 1,
      max_attempts: Number(row.max_attempts),
    };
    await client.query(
      `UPDATE ai_factory_jobs
          SET status = 'running', attempts = attempts + 1, started_at = now(),
              updated_at = now(), error_code = NULL
        WHERE id = $1`,
      [job.id],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('AI factory worker claim failed', error);
    return NextResponse.json({ error: 'Unable to claim a job' }, { status: 500 });
  } finally {
    client.release();
  }

  if (!job) {
    return NextResponse.json({ error: 'No job was claimed' }, { status: 500 });
  }

  try {
    const generated = await generateFactoryOutput(job);
    const output = {
      summary: generated.summary,
      result: generated.result,
      requiresHumanReview: generated.requiresHumanReview,
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    };
    const finishClient = await db.connect();
    try {
      await finishClient.query('BEGIN');
      if (generated.requiresHumanReview) {
        await finishClient.query(
          `INSERT INTO ai_factory_drafts (job_id, draft)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (job_id) DO UPDATE
             SET draft = EXCLUDED.draft, review_status = 'pending',
                 reviewed_by = NULL, reviewed_at = NULL`,
          [job.id, JSON.stringify(output)],
        );
      }
      await finishClient.query(
        `UPDATE ai_factory_jobs
            SET status = $2, output = $3::jsonb, error_code = NULL,
                updated_at = now(), completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE NULL END
          WHERE id = $1 AND status = 'running'`,
        [job.id, generated.requiresHumanReview ? 'needs_review' : 'completed', JSON.stringify(output)],
      );
      await finishClient.query(
        `INSERT INTO audit_logs (action, resource_type, resource_id, after_json)
         VALUES ('ai_factory.job_processed', 'ai_factory_job', $1, $2::jsonb)`,
        [job.id, JSON.stringify({ jobType: job.job_type, status: generated.requiresHumanReview ? 'needs_review' : 'completed' })],
      );
      await finishClient.query('COMMIT');
    } catch (error) {
      await finishClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      finishClient.release();
    }
    return NextResponse.json({ processed: true, jobId: job.id, status: generated.requiresHumanReview ? 'needs_review' : 'completed' });
  } catch (error) {
    const code = error instanceof Error && /^[A-Z0-9_]{3,64}$/.test(error.message)
      ? error.message
      : 'JOB_PROCESSING_FAILED';
    console.error('AI factory job processing failed', { jobId: job.id, code });
    try {
      await db.query(
        `UPDATE ai_factory_jobs
            SET status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
                error_code = $2, updated_at = now(),
                completed_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END
          WHERE id = $1 AND status = 'running'`,
        [job.id, code],
      );
    } catch (saveError) {
      console.error('AI factory failure state could not be saved', saveError);
    }
    return NextResponse.json({ processed: true, jobId: job.id, status: 'retry_or_failed', errorCode: code }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return processOne(request);
}
