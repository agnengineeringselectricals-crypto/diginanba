-- Additive private Factory foundation extracted from db/schema.sql.
-- Requires the application base tables (users, roles, products, markets, categories, subcategories).
-- Stage 1: private Autonomous Product Factory pipeline storage only.
-- No workers, AI integrations, APIs, or automatic publishing are enabled by these tables.
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (btrim(agent_type) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS agent_runs_status_created_idx ON agent_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_type_created_idx ON agent_runs(agent_type, created_at DESC);

CREATE TABLE IF NOT EXISTS research_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT NOT NULL REFERENCES markets(code),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  problem_statement TEXT NOT NULL CHECK (btrim(problem_statement) <> ''),
  opportunity_score NUMERIC(5,2) CHECK (opportunity_score BETWEEN 0 AND 100),
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','scoring','qualified','rejected','converted','archived')),
  source_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_opportunities_market_status_score_idx ON research_opportunities(market_code, status, opportunity_score DESC);
CREATE INDEX IF NOT EXISTS research_opportunities_created_idx ON research_opportunities(created_at DESC);

CREATE TABLE IF NOT EXISTS product_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES research_opportunities(id),
  product_id UUID REFERENCES products(id),
  job_type TEXT NOT NULL CHECK (btrim(job_type) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','awaiting_review','completed','failed','cancelled')),
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_jobs_opportunity_created_idx ON product_jobs(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_jobs_status_created_idx ON product_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_jobs_product_idx ON product_jobs(product_id) WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_job_id UUID NOT NULL REFERENCES product_jobs(id),
  product_id UUID REFERENCES products(id),
  asset_type TEXT NOT NULL CHECK (btrim(asset_type) <> ''),
  storage_key TEXT NOT NULL CHECK (btrim(storage_key) <> ''),
  file_name TEXT NOT NULL CHECK (btrim(file_name) <> ''),
  mime_type TEXT NOT NULL CHECK (btrim(mime_type) <> ''),
  version INT NOT NULL DEFAULT 1 CHECK (version > 0),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','validated','rejected','failed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_assets_job_created_idx ON product_assets(product_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_assets_product_idx ON product_assets(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_assets_status_idx ON product_assets(status);

CREATE TABLE IF NOT EXISTS localization_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  source_market_code TEXT NOT NULL REFERENCES markets(code),
  target_market_code TEXT NOT NULL REFERENCES markets(code),
  source_locale TEXT NOT NULL CHECK (btrim(source_locale) <> ''),
  target_locale TEXT NOT NULL CHECK (btrim(target_locale) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','review_required','completed','failed','cancelled')),
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_market_code <> target_market_code OR source_locale <> target_locale)
);
CREATE INDEX IF NOT EXISTS localization_jobs_product_created_idx ON localization_jobs(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS localization_jobs_target_status_idx ON localization_jobs(target_market_code, status, created_at DESC);

CREATE TABLE IF NOT EXISTS quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  product_job_id UUID REFERENCES product_jobs(id),
  check_type TEXT NOT NULL CHECK (btrim(check_type) <> ''),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','failed','warning','skipped')),
  score NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100),
  findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR product_job_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS quality_checks_product_checked_idx ON quality_checks(product_id, checked_at DESC) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quality_checks_job_checked_idx ON quality_checks(product_job_id, checked_at DESC) WHERE product_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quality_checks_status_checked_idx ON quality_checks(status, checked_at DESC);

CREATE TABLE IF NOT EXISTS publishing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  product_edition_id UUID REFERENCES product_editions(id),
  market_code TEXT NOT NULL REFERENCES markets(code),
  locale TEXT NOT NULL CHECK (btrim(locale) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','awaiting_approval','approved','publishing','published','rejected','failed','cancelled')),
  approval_required BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR published_at IS NOT NULL),
  CHECK (approval_required IS FALSE OR status NOT IN ('publishing','published') OR approved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS publishing_jobs_status_created_idx ON publishing_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS publishing_jobs_product_market_idx ON publishing_jobs(product_id, market_code, locale);
CREATE INDEX IF NOT EXISTS publishing_jobs_approval_idx ON publishing_jobs(approval_required, status) WHERE approval_required IS TRUE;

CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id),
  event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warning','error')),
  message TEXT NOT NULL CHECK (btrim(message) <> ''),
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_events_run_created_idx ON agent_events(agent_run_id, created_at);
CREATE INDEX IF NOT EXISTS agent_events_level_created_idx ON agent_events(level, created_at DESC);

-- Stage 1 extension: private marketing/growth foundation and a fail-closed cost policy.
-- These tables do not connect external services or execute/schedule any work.
CREATE TABLE IF NOT EXISTS agent_financial_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL DEFAULT '*' CHECK (btrim(agent_type) <> ''),
  max_spend_minor BIGINT NOT NULL DEFAULT 0 CHECK (max_spend_minor = 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency_code ~ '^[A-Z]{3}$'),
  paid_actions_allowed BOOLEAN NOT NULL DEFAULT false CHECK (paid_actions_allowed IS FALSE),
  owner_approval_required BOOLEAN NOT NULL DEFAULT true CHECK (owner_approval_required IS TRUE),
  free_resource_allowed BOOLEAN NOT NULL DEFAULT true,
  unknown_cost_action TEXT NOT NULL DEFAULT 'block' CHECK (unknown_cost_action = 'block'),
  policy_status TEXT NOT NULL DEFAULT 'active' CHECK (policy_status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_type)
);
INSERT INTO agent_financial_policies(agent_type,max_spend_minor,currency_code,paid_actions_allowed,owner_approval_required,free_resource_allowed,unknown_cost_action,policy_status)
VALUES ('*',0,'INR',false,true,true,'block','active')
ON CONFLICT(agent_type) DO NOTHING;
CREATE INDEX IF NOT EXISTS agent_financial_policies_status_idx ON agent_financial_policies(policy_status, agent_type);

CREATE TABLE IF NOT EXISTS marketing_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT REFERENCES markets(code),
  country_code TEXT,
  region_code TEXT,
  state_code TEXT,
  zone_code TEXT,
  locale TEXT,
  product_id UUID REFERENCES products(id),
  category_id UUID REFERENCES categories(id),
  objective TEXT NOT NULL CHECK (btrim(objective) <> ''),
  strategy_type TEXT NOT NULL CHECK (btrim(strategy_type) <> ''),
  audience_definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  positioning_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review_required','approved','active','paused','completed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_strategies_market_status_idx ON marketing_strategies(market_code, status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_strategies_product_idx ON marketing_strategies(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_strategies_category_idx ON marketing_strategies(category_id) WHERE category_id IS NOT NULL;
ALTER TABLE marketing_strategies ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS marketing_strategies_idempotency_idx ON marketing_strategies(idempotency_key);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES marketing_strategies(id),
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  objective TEXT NOT NULL CHECK (btrim(objective) <> ''),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_approval','approved','active','paused','completed','cancelled')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  budget_json JSONB,
  target_definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at),
  CHECK (status NOT IN ('approved','active') OR approval_required IS FALSE OR approved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_strategy_status_idx ON marketing_campaigns(strategy_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_campaigns_product_idx ON marketing_campaigns(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_campaigns_approval_idx ON marketing_campaigns(status, approved_at) WHERE approval_required IS TRUE;
ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS marketing_campaigns_idempotency_idx ON marketing_campaigns(idempotency_key);

CREATE TABLE IF NOT EXISTS marketing_campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  continent TEXT,
  country_code TEXT,
  region_code TEXT,
  state_code TEXT,
  zone_code TEXT,
  city TEXT,
  language_code TEXT,
  audience_segment TEXT,
  targeting_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_campaign_targets_campaign_idx ON marketing_campaign_targets(campaign_id, country_code, region_code);

CREATE TABLE IF NOT EXISTS audience_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT,
  market_code TEXT REFERENCES markets(code),
  country_code TEXT,
  region_code TEXT,
  state_code TEXT,
  zone_code TEXT,
  locale TEXT,
  segment_definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audience_segments_market_status_idx ON audience_segments(market_code, status, name);

CREATE TABLE IF NOT EXISTS marketing_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  product_id UUID REFERENCES products(id),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  content_type TEXT NOT NULL CHECK (btrim(content_type) <> ''),
  locale TEXT NOT NULL CHECK (btrim(locale) <> ''),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  body TEXT NOT NULL,
  media_reference TEXT,
  call_to_action TEXT,
  destination_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','pending_approval','approved','rejected','archived')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approval_status <> 'approved' OR approved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_content_campaign_status_idx ON marketing_content(campaign_id, approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_content_product_idx ON marketing_content(product_id) WHERE product_id IS NOT NULL;
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS marketing_content_idempotency_idx ON marketing_content(idempotency_key);

CREATE TABLE IF NOT EXISTS marketing_channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  account_name TEXT NOT NULL CHECK (btrim(account_name) <> ''),
  account_reference TEXT,
  market_code TEXT REFERENCES markets(code),
  status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('unconfigured','pending_authorization','authorized','disabled','revoked')),
  integration_type TEXT NOT NULL CHECK (btrim(integration_type) <> ''),
  permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (metadata_json ?| ARRAY['password','api_key','access_token','refresh_token','secret','token','credentials']))
);
CREATE INDEX IF NOT EXISTS marketing_channel_accounts_market_status_idx ON marketing_channel_accounts(market_code, status, channel);

CREATE TABLE IF NOT EXISTS marketing_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  marketing_content_id UUID NOT NULL REFERENCES marketing_content(id),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','scheduled','published','failed','cancelled')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  failure_reason TEXT,
  response_metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_publications_campaign_status_idx ON marketing_publications(campaign_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS marketing_publications_content_idx ON marketing_publications(marketing_content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  marketing_content_id UUID REFERENCES marketing_content(id),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  market_code TEXT REFERENCES markets(code),
  country_code TEXT,
  region_code TEXT,
  metric_date DATE NOT NULL,
  impressions BIGINT CHECK (impressions >= 0),
  clicks BIGINT CHECK (clicks >= 0),
  visits BIGINT CHECK (visits >= 0),
  conversions BIGINT CHECK (conversions >= 0),
  sales BIGINT CHECK (sales >= 0),
  revenue_minor BIGINT CHECK (revenue_minor >= 0),
  spend_minor BIGINT CHECK (spend_minor >= 0),
  ctr NUMERIC(8,6) CHECK (ctr BETWEEN 0 AND 1),
  conversion_rate NUMERIC(8,6) CHECK (conversion_rate BETWEEN 0 AND 1),
  roas NUMERIC(12,4) CHECK (roas >= 0),
  metrics_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, marketing_content_id, channel, metric_date)
);
CREATE INDEX IF NOT EXISTS marketing_metrics_campaign_date_idx ON marketing_metrics(campaign_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS marketing_metrics_market_date_idx ON marketing_metrics(market_code, country_code, metric_date DESC);

CREATE TABLE IF NOT EXISTS marketing_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  experiment_type TEXT NOT NULL CHECK (btrim(experiment_type) <> ''),
  hypothesis TEXT NOT NULL CHECK (btrim(hypothesis) <> ''),
  variant_a_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  variant_b_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','running','completed','cancelled')),
  winner TEXT CHECK (winner IN ('a','b')),
  results_json JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS marketing_experiments_campaign_status_idx ON marketing_experiments(campaign_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (btrim(agent_type) <> ''),
  schedule_expression TEXT NOT NULL CHECK (btrim(schedule_expression) <> ''),
  timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (btrim(timezone) <> ''),
  enabled BOOLEAN NOT NULL DEFAULT false,
  configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_schedules_agent_enabled_idx ON agent_schedules(agent_type, enabled, next_run_at);

-- Stage 2+: durable orchestrator, provider cost catalog, approvals and feedback.
-- No worker, schedule, or external provider is activated by this schema.
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS region_code TEXT;
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS locale TEXT;
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'LOW' CHECK (priority IN ('HIGH','MEDIUM','LOW'));
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1);
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS source_references_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS opportunity_key TEXT;
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE research_opportunities ADD COLUMN IF NOT EXISTS subcategory_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='research_opportunities_subcategory_category_fk' AND conrelid='research_opportunities'::regclass) THEN
    ALTER TABLE research_opportunities ADD CONSTRAINT research_opportunities_subcategory_category_fk FOREIGN KEY (subcategory_id,category_id) REFERENCES subcategories(id,category_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='research_opportunities_subcategory_requires_category' AND conrelid='research_opportunities'::regclass) THEN
    ALTER TABLE research_opportunities ADD CONSTRAINT research_opportunities_subcategory_requires_category CHECK (subcategory_id IS NULL OR category_id IS NOT NULL);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS research_opportunities_key_idx ON research_opportunities(opportunity_key) WHERE opportunity_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS research_opportunities_category_idx ON research_opportunities(category_id, subcategory_id) WHERE category_id IS NOT NULL;
ALTER TABLE product_jobs ADD COLUMN IF NOT EXISTS agent_job_id UUID;
ALTER TABLE product_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE product_jobs ADD COLUMN IF NOT EXISTS brief_version INT NOT NULL DEFAULT 1 CHECK (brief_version > 0);
CREATE UNIQUE INDEX IF NOT EXISTS product_jobs_idempotency_idx ON product_jobs(idempotency_key);
ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS publishing_jobs_idempotency_idx ON publishing_jobs(idempotency_key);
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS asset_bytes BYTEA;
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0);
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS product_assets_idempotency_idx ON product_assets(idempotency_key);
ALTER TABLE localization_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS localization_jobs_idempotency_idx ON localization_jobs(idempotency_key);
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_terms TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id),
  parent_job_id UUID REFERENCES agent_jobs(id),
  job_type TEXT NOT NULL CHECK (btrim(job_type) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','waiting_dependency','running','retry_wait','completed','failed','blocked','provider_required','approval_required','cancelled')),
  cost_class TEXT NOT NULL DEFAULT 'FREE' CHECK (cost_class IN ('FREE','FREE_WITH_LIMIT','PAID','UNKNOWN','BLOCKED')),
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (btrim(idempotency_key) <> ''),
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INT NOT NULL DEFAULT 2 CHECK (max_retries BETWEEN 0 AND 5),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS agent_jobs_run_status_idx ON agent_jobs(agent_run_id, status, created_at);
CREATE INDEX IF NOT EXISTS agent_jobs_claim_idx ON agent_jobs(status, available_at, created_at) WHERE status IN ('queued','retry_wait');
CREATE INDEX IF NOT EXISTS agent_jobs_parent_idx ON agent_jobs(parent_job_id) WHERE parent_job_id IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_jobs_agent_job_fk' AND conrelid='product_jobs'::regclass) THEN
    ALTER TABLE product_jobs ADD CONSTRAINT product_jobs_agent_job_fk FOREIGN KEY (agent_job_id) REFERENCES agent_jobs(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS product_jobs_agent_job_idx ON product_jobs(agent_job_id) WHERE agent_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_resource_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL UNIQUE CHECK (btrim(provider_key) <> ''),
  display_name TEXT NOT NULL CHECK (btrim(display_name) <> ''),
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  cost_class TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (cost_class IN ('FREE','FREE_WITH_LIMIT','PAID','UNKNOWN','BLOCKED')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  automatic_allowed BOOLEAN NOT NULL DEFAULT false,
  max_runs_per_day INT CHECK (max_runs_per_day IS NULL OR max_runs_per_day > 0),
  policy_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cost_class NOT IN ('PAID','UNKNOWN','BLOCKED') OR automatic_allowed IS FALSE),
  CHECK (cost_class <> 'FREE_WITH_LIMIT' OR max_runs_per_day IS NOT NULL)
);
INSERT INTO agent_resource_providers(provider_key,display_name,capabilities,cost_class,enabled,automatic_allowed,policy_notes)
VALUES ('diginanba-local-deterministic','DigiNanba local deterministic processing',ARRAY['catalog_inventory','opportunity_scoring','product_brief','asset_validation','metadata_validation','policy_checks'],'FREE',true,true,'Runs deterministic code against DigiNanba data; no external service or API key.')
ON CONFLICT(provider_key) DO NOTHING;
CREATE INDEX IF NOT EXISTS agent_resource_providers_cost_enabled_idx ON agent_resource_providers(cost_class, enabled, automatic_allowed);

CREATE TABLE IF NOT EXISTS agent_resource_usage (
  provider_id UUID NOT NULL REFERENCES agent_resource_providers(id),
  usage_date DATE NOT NULL,
  used_runs INT NOT NULL DEFAULT 0 CHECK (used_runs >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(provider_id, usage_date)
);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_job_id UUID NOT NULL REFERENCES agent_jobs(id),
  approval_type TEXT NOT NULL CHECK (approval_type IN ('publishing','external_communication','paid_operation','integration','sensitive_operation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  request_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR status NOT IN ('approved','rejected'))
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_approvals_one_pending_per_job_idx ON agent_approvals(agent_job_id, approval_type) WHERE status='pending';
CREATE INDEX IF NOT EXISTS agent_approvals_status_requested_idx ON agent_approvals(status, requested_at);

CREATE TABLE IF NOT EXISTS market_feedback_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('aggregated_analytics','catalog_performance','campaign_metrics','deidentified_feedback','operator_note')),
  source_reference TEXT,
  market_code TEXT REFERENCES markets(code),
  product_id UUID REFERENCES products(id),
  research_opportunity_id UUID REFERENCES research_opportunities(id),
  signal_type TEXT NOT NULL CHECK (btrim(signal_type) <> ''),
  summary TEXT NOT NULL CHECK (btrim(summary) <> ''),
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE market_feedback_signals IS 'Private aggregated or de-identified signals only; do not store direct personal information.';
CREATE INDEX IF NOT EXISTS market_feedback_signals_unprocessed_idx ON market_feedback_signals(observed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS market_feedback_signals_market_type_idx ON market_feedback_signals(market_code, signal_type, observed_at DESC);
