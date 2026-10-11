-- Stage 7: private product opportunity and creation workflow queue.
-- Apply this migration to the production PostgreSQL database before enabling internal job operations.
CREATE TABLE IF NOT EXISTS product_factory_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('demand_research','product_draft','localization','quality_review')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','researching','drafting','quality_review','ready','failed','cancelled')),
  market_code TEXT REFERENCES markets(code),
  locale TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  last_error TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_factory_jobs_queue_idx
  ON product_factory_jobs(status, available_at, created_at)
  WHERE status IN ('queued','failed');
CREATE INDEX IF NOT EXISTS product_factory_jobs_market_created_idx
  ON product_factory_jobs(market_code, created_at DESC);
CREATE INDEX IF NOT EXISTS product_factory_jobs_product_idx
  ON product_factory_jobs(product_id) WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_factory_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES product_factory_jobs(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'status_change',
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_factory_job_events_job_created_idx
  ON product_factory_job_events(job_id, created_at);

INSERT INTO permissions(key, description)
VALUES ('product_factory.manage', 'Create and manage private product research and creation jobs')
ON CONFLICT (key) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('Super Admin','AI Factory Manager') AND p.key='product_factory.manage'
ON CONFLICT DO NOTHING;
