-- DigiNanba AI workforce foundation.
-- Creates persistent AI agent definitions, task queue and execution audit.
-- Idempotent: safe to apply more than once.
CREATE TABLE IF NOT EXISTS ai_workforce_agents (
  id BIGSERIAL PRIMARY KEY,
  agent_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department_code TEXT NOT NULL,
  team_name TEXT,
  agent_level TEXT NOT NULL CHECK (agent_level IN ('orchestrator','department_manager','team_leader','staff')),
  responsibilities TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  autonomy_mode TEXT NOT NULL DEFAULT 'recommend' CHECK (autonomy_mode IN ('recommend','execute_safe')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_workforce_tasks (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT REFERENCES ai_workforce_agents(id) ON DELETE SET NULL,
  department_code TEXT NOT NULL,
  team_name TEXT,
  title TEXT NOT NULL,
  task_description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','needs_approval','completed','failed','cancelled')),
  result_summary TEXT,
  result_json JSONB,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS ai_workforce_runs (
  id BIGSERIAL PRIMARY KEY,
  run_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','completed','partial','failed')),
  agents_processed INTEGER NOT NULL DEFAULT 0,
  tasks_created INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_workforce_agents_department ON ai_workforce_agents(department_code, enabled);
CREATE INDEX IF NOT EXISTS idx_ai_workforce_tasks_queue ON ai_workforce_tasks(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_workforce_runs_started ON ai_workforce_runs(started_at DESC);

INSERT INTO ai_workforce_agents
(agent_key, display_name, department_code, team_name, agent_level, responsibilities, autonomy_mode)
VALUES
('central-orchestrator','Central AI Orchestrator','all',NULL,'orchestrator','Coordinate department agents, prioritize tasks, consolidate reports, identify blockers and escalate sensitive decisions. Never authorize payments, refunds, security changes or legal commitments.', 'recommend'),
('accounts-security-manager','Accounts & Security AI Manager','accounts-security',NULL,'department_manager','Monitor account operations, authentication health, access-control gaps and compliance checklists. Recommend security changes; never modify access or credentials autonomously.', 'recommend'),
('accounts-access-lead','Access & Account Support AI Lead','accounts-security','Access & Account Support','team_leader','Triage account-access support and draft safe help responses; escalate identity, takeover and credential cases.', 'recommend'),
('accounts-security-staff','Security & Compliance AI Staff','accounts-security','Security & Compliance','staff','Prepare security checklists, summarize audit events and flag suspicious patterns for human review.', 'recommend'),
('customer-care-manager','Customer Care AI Manager','customer-care',NULL,'department_manager','Classify support demand, monitor response quality and prepare customer-service summaries.', 'recommend'),
('customer-support-lead','Customer Support AI Lead','customer-care','Customer Support','team_leader','Organize support tasks, draft answers from approved policy and escalate unresolved cases.', 'recommend'),
('customer-escalations-staff','Complaints & Escalations AI Staff','customer-care','Complaints & Escalations','staff','Summarize complaints, categorize urgency and draft empathetic responses for review.', 'recommend'),
('catalog-manager','Products & Catalog AI Manager','products-catalog',NULL,'department_manager','Monitor catalog quality, missing metadata, category coverage and publishing readiness.', 'recommend'),
('catalog-operations-lead','Catalog Operations AI Lead','products-catalog','Catalog Operations','team_leader','Identify listing inconsistencies and create metadata-improvement tasks.', 'recommend'),
('catalog-review-staff','Product Review & Publishing AI Staff','products-catalog','Product Review & Publishing','staff','Check product descriptions, completeness, originality indicators and quality requirements; flag items for review.', 'recommend'),
('users-creators-manager','Users & Creators AI Manager','users-creators',NULL,'department_manager','Review onboarding friction, creator needs and marketplace participation using available aggregated data.', 'recommend'),
('user-operations-lead','User Operations AI Lead','users-creators','User Operations','team_leader','Prepare onboarding guidance and identify account-support workflow improvements.', 'recommend'),
('creator-success-staff','Creator Success AI Staff','users-creators','Creator Success','staff','Draft creator guides, product checklists and educational content for review.', 'recommend'),
('product-factory-manager','AI Product Factory AI Manager','ai-product-factory',NULL,'department_manager','Prioritize digital-product opportunities from validated demand signals and coordinate creation, quality and release workflows.', 'recommend'),
('demand-research-lead','Demand Research AI Lead','ai-product-factory','Demand Research','team_leader','Develop research briefs and hypotheses; distinguish verified evidence from assumptions.', 'recommend'),
('product-generation-staff','Product Generation & QA AI Staff','ai-product-factory','Product Generation & QA','staff','Draft digital-product concepts, outlines and QA checklists; do not publish or claim sales without approval and evidence.', 'recommend'),
('localization-release-staff','Localization & Release AI Staff','ai-product-factory','Localization & Release','staff','Prepare localization plans and review checklists for language, currency and market suitability.', 'recommend'),
('finance-manager','Finance & Payments AI Manager','finance-payments',NULL,'department_manager','Reconcile available order/payment records, flag discrepancies and prepare reports; all money movement requires human approval.', 'recommend'),
('orders-reconciliation-lead','Orders & Reconciliation AI Lead','finance-payments','Orders & Reconciliation','team_leader','Prepare order exception and reconciliation queues without changing balances or initiating payments.', 'recommend'),
('finance-reporting-staff','Settlements & Reporting AI Staff','finance-payments','Settlements & Reporting','staff','Produce draft summaries of available settlement data and flag missing records.', 'recommend'),
('marketing-manager','Marketing & Growth AI Manager','marketing-growth',NULL,'department_manager','Plan ethical acquisition, SEO and retention experiments; do not spend advertising budget or publish externally without approval.', 'recommend'),
('seo-content-lead','SEO & Content AI Lead','marketing-growth','SEO & Content','team_leader','Create keyword research briefs, content plans and SEO improvement tasks based on available evidence.', 'recommend'),
('campaigns-partnerships-staff','Campaigns & Partnerships AI Staff','marketing-growth','Campaigns & Partnerships','staff','Draft campaign concepts, partnership outreach and measurement plans for approval.', 'recommend'),
('markets-manager','Localization & Markets AI Manager','localization-markets',NULL,'department_manager','Track market readiness, language coverage and currency configuration; flag country-specific legal/tax questions.', 'recommend'),
('language-localization-lead','Language Localization AI Lead','localization-markets','Language Localization','team_leader','Coordinate translation and localization QA tasks, preserving meaning and locale conventions.', 'recommend'),
('country-currency-staff','Country & Currency Operations AI Staff','localization-markets','Country & Currency Operations','staff','Audit configured markets, language and currency mappings and produce discrepancy reports.', 'recommend')
ON CONFLICT (agent_key) DO UPDATE SET
 display_name=EXCLUDED.display_name,
 department_code=EXCLUDED.department_code,
 team_name=EXCLUDED.team_name,
 agent_level=EXCLUDED.agent_level,
 responsibilities=EXCLUDED.responsibilities,
 updated_at=now();

-- Seed one initial, low-risk planning task for the orchestrator.
INSERT INTO ai_workforce_tasks
(agent_id, department_code, title, task_description, priority, status, requires_approval)
SELECT id, 'all', 'Initial marketplace operations review',
'Review available platform health, catalog coverage, user onboarding, order/payment status and market configuration. Produce a prioritized report using only accessible data. Clearly label missing evidence. Do not change production data or execute financial/security actions.',
'high', 'queued', FALSE
FROM ai_workforce_agents
WHERE agent_key='central-orchestrator'
AND NOT EXISTS (
 SELECT 1 FROM ai_workforce_tasks WHERE title='Initial marketplace operations review'
);
