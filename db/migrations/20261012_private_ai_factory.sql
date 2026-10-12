-- DigiNanba private AI factory job queue foundation.
-- Additive migration: does not alter or drop existing marketplace tables.
-- Apply only after reviewing the target database and migration process.

CREATE TABLE IF NOT EXISTS ai_factory_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('market_research', 'product_outline', 'product_draft', 'localization', 'quality_review')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'needs_review', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK (output IS NULL OR jsonb_typeof(output) = 'object')
);

CREATE INDEX IF NOT EXISTS ai_factory_jobs_queue_idx
  ON ai_factory_jobs (created_at, id)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS ai_factory_jobs_status_updated_idx
  ON ai_factory_jobs (status, updated_at);

-- Product drafts created by the factory must remain drafts until an authorized
-- human explicitly reviews and publishes them. This table stores references,
-- not downloadable customer assets or API secrets.
CREATE TABLE IF NOT EXISTS ai_factory_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES ai_factory_jobs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  draft JSONB NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(draft) = 'object')
);

CREATE INDEX IF NOT EXISTS ai_factory_drafts_review_idx
  ON ai_factory_drafts (review_status, created_at);
