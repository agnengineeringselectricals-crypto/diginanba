-- DigiNanba AI usage ledger and spending guardrails.
-- Safe to apply repeatedly. Apply this migration in Neon before running AI factory jobs.
CREATE TABLE IF NOT EXISTS factory_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES product_factory_jobs(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cached_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  cost_usd NUMERIC(18,10) NOT NULL CHECK (cost_usd >= 0),
  pricing_source TEXT NOT NULL,
  provider_usage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factory_ai_usage_created_idx
  ON factory_ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS factory_ai_usage_job_idx
  ON factory_ai_usage(job_id, created_at);
CREATE INDEX IF NOT EXISTS factory_ai_usage_requester_idx
  ON factory_ai_usage(requested_by, created_at DESC);
