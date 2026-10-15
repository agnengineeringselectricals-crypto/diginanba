import 'server-only';

import { db } from '@/lib/db';

export const productJobTypes = ['demand_research', 'product_draft', 'localization', 'quality_review'] as const;
export const productJobStatuses = ['queued', 'researching', 'drafting', 'quality_review', 'ready', 'failed', 'cancelled'] as const;
export type ProductJobType = typeof productJobTypes[number];
export type ProductJobStatus = typeof productJobStatuses[number];

export type NewProductJob = {
  jobType: ProductJobType;
  marketCode?: 'IN' | 'US' | 'UK';
  locale?: string;
  categoryId?: string;
  input: Record<string, unknown>;
  maxAttempts?: number;
};

const transitions: Record<ProductJobStatus, ProductJobStatus[]> = {
  queued: ['researching', 'cancelled'],
  researching: ['drafting', 'quality_review', 'failed', 'cancelled'],
  drafting: ['quality_review', 'failed', 'cancelled'],
  quality_review: ['drafting', 'ready', 'failed', 'cancelled'],
  ready: [],
  failed: ['queued', 'cancelled'],
  cancelled: [],
};

export async function createProductFactoryJob(input: NewProductJob, requestedBy: string) {
  const result = await db.query(
    `INSERT INTO product_factory_jobs
      (job_type, market_code, locale, category_id, requested_by, input_json, max_attempts)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id, job_type, status, market_code, locale, category_id, input_json,
       attempt_count, max_attempts, created_at, updated_at`,
    [input.jobType, input.marketCode ?? null, input.locale ?? null, input.categoryId ?? null,
      requestedBy, JSON.stringify(input.input ?? {}), input.maxAttempts ?? 3],
  );
  const job = result.rows[0];
  await db.query(
    `INSERT INTO product_factory_job_events(job_id, actor_user_id, to_status, event_type, details_json)
     VALUES ($1, $2, 'queued', 'created', $3::jsonb)`,
    [job.id, requestedBy, JSON.stringify({ jobType: input.jobType })],
  );
  return job;
}

export async function listProductFactoryJobs(limit = 25) {
  const result = await db.query(
    `SELECT id, job_type, status, market_code, locale, category_id, product_id,
       input_json, result_json, attempt_count, max_attempts, last_error,
       available_at, started_at, completed_at, created_at, updated_at
     FROM product_factory_jobs
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(100, limit))],
  );
  return result.rows;
}

export async function transitionProductFactoryJob(
  jobId: string,
  nextStatus: ProductJobStatus,
  actorUserId: string,
  details: Record<string, unknown> = {},
  errorMessage?: string,
) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      'SELECT id, status, attempt_count, max_attempts, started_at FROM product_factory_jobs WHERE id = $1 FOR UPDATE',
      [jobId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error('Job not found');
    const currentStatus = current.status as ProductJobStatus;
    if (!transitions[currentStatus]?.includes(nextStatus)) {
      throw new Error(`Invalid job transition: ${currentStatus} → ${nextStatus}`);
    }
    if (currentStatus === 'failed' && nextStatus === 'queued' && Number(current.attempt_count) >= Number(current.max_attempts)) {
      throw new Error('Maximum retry attempts reached');
    }
    const nowStarted = nextStatus === 'researching' && !current.started_at;
    const terminal = ['ready', 'failed', 'cancelled'].includes(nextStatus);
    const updated = await client.query(
      `UPDATE product_factory_jobs
       SET status = $2,
           attempt_count = attempt_count + CASE WHEN $2 = 'researching' THEN 1 ELSE 0 END,
           last_error = CASE WHEN $2 = 'failed' THEN $3 ELSE CASE WHEN $2 = 'queued' THEN NULL ELSE last_error END END,
           available_at = CASE WHEN $2 = 'queued' THEN now() ELSE available_at END,
           locked_at = CASE WHEN $2 IN ('queued','ready','failed','cancelled') THEN NULL ELSE locked_at END,
           locked_by = CASE WHEN $2 IN ('queued','ready','failed','cancelled') THEN NULL ELSE locked_by END,
           started_at = CASE WHEN $4 THEN now() ELSE started_at END,
           completed_at = CASE WHEN $5 THEN now() ELSE NULL END,
           updated_at = now()
       WHERE id = $1
       RETURNING id, job_type, status, market_code, locale, product_id, attempt_count, max_attempts, last_error, created_at, updated_at, completed_at`,
      [jobId, nextStatus, errorMessage ?? null, nowStarted, terminal],
    );
    await client.query(
      `INSERT INTO product_factory_job_events(job_id, actor_user_id, from_status, to_status, event_type, details_json)
       VALUES ($1, $2, $3, $4, 'status_change', $5::jsonb)`,
      [jobId, actorUserId, currentStatus, nextStatus, JSON.stringify(details)],
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
