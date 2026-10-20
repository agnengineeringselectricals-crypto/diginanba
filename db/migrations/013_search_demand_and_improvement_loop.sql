-- Search demand intelligence, geographic hierarchy, and community improvement rewards.
-- Search records store normalized query text and coarse location metadata only; raw IP addresses are not stored.
BEGIN;

CREATE TABLE IF NOT EXISTS geography_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES geography_nodes(id) ON DELETE RESTRICT,
  level TEXT NOT NULL CHECK (level IN ('continent','region','country','state','province','district','county','city','locality')),
  code TEXT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  country_code CHAR(2),
  locale TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (parent_id, level, normalized_name)
);
CREATE INDEX IF NOT EXISTS geography_nodes_parent_level_idx ON geography_nodes(parent_id, level);
CREATE INDEX IF NOT EXISTS geography_nodes_country_level_idx ON geography_nodes(country_code, level);

CREATE TABLE IF NOT EXISTS product_search_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  visitor_key_hash TEXT,
  query_text TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  query_language TEXT,
  market_code CHAR(2),
  locale TEXT,
  geography_node_id UUID REFERENCES geography_nodes(id) ON DELETE SET NULL,
  country_code CHAR(2),
  region_code TEXT,
  results_count INTEGER NOT NULL DEFAULT 0 CHECK (results_count >= 0),
  clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  converted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'search_bar' CHECK (source IN ('search_bar','explore','category','voice','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_search_events_time_idx ON product_search_events(created_at DESC);
CREATE INDEX IF NOT EXISTS product_search_events_query_geo_idx ON product_search_events(normalized_query, geography_node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_search_events_user_idx ON product_search_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_demand_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_query TEXT NOT NULL,
  display_query TEXT NOT NULL,
  query_language TEXT,
  geography_node_id UUID REFERENCES geography_nodes(id) ON DELETE SET NULL,
  country_code CHAR(2),
  market_code CHAR(2),
  event_count BIGINT NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  zero_result_count BIGINT NOT NULL DEFAULT 0 CHECK (zero_result_count >= 0),
  product_click_count BIGINT NOT NULL DEFAULT 0 CHECK (product_click_count >= 0),
  purchase_count BIGINT NOT NULL DEFAULT 0 CHECK (purchase_count >= 0),
  last_searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  demand_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'observed' CHECK (status IN ('observed','researching','opportunity','queued_for_factory','in_production','fulfilled','dismissed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (normalized_query, geography_node_id, market_code, query_language)
);
CREATE INDEX IF NOT EXISTS product_demand_clusters_score_idx ON product_demand_clusters(status, demand_score DESC, last_searched_at DESC);
CREATE INDEX IF NOT EXISTS product_demand_clusters_geo_idx ON product_demand_clusters(geography_node_id, event_count DESC);

CREATE TABLE IF NOT EXISTS product_demand_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_cluster_id UUID REFERENCES product_demand_clusters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  proposed_product_type TEXT,
  target_geography_node_id UUID REFERENCES geography_nodes(id) ON DELETE SET NULL,
  target_market_code CHAR(2),
  target_locale TEXT,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_demand_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  ai_research_status TEXT NOT NULL DEFAULT 'pending' CHECK (ai_research_status IN ('pending','researching','complete','failed','needs_human_review')),
  factory_job_id UUID,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','queued','building','quality_review','published','closed')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_demand_opportunities_queue_idx ON product_demand_opportunities(status, estimated_demand_score DESC, created_at);

CREATE TABLE IF NOT EXISTS product_improvement_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_build_id UUID REFERENCES product_builds(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitter_visitor_hash TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestion_kind TEXT NOT NULL DEFAULT 'feature' CHECK (suggestion_kind IN ('feature','bug','content_correction','accessibility','localization','translation','performance','other')),
  target_geography_node_id UUID REFERENCES geography_nodes(id) ON DELETE SET NULL,
  target_locale TEXT,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','duplicate','triaged','accepted','in_progress','implemented','verified','rejected','withdrawn')),
  duplicate_of UUID REFERENCES product_improvement_suggestions(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  accepted_at TIMESTAMPTZ,
  implemented_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_improvement_suggestions_product_status_idx ON product_improvement_suggestions(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_improvement_suggestions_queue_idx ON product_improvement_suggestions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS improvement_reward_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reward_kind TEXT NOT NULL DEFAULT 'manual_review' CHECK (reward_kind IN ('fixed','tiered','revenue_share','manual_review')),
  currency_code CHAR(3),
  default_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (default_amount_minor >= 0),
  policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
INSERT INTO improvement_reward_policies(policy_key, enabled, reward_kind, default_amount_minor)
VALUES ('accepted_product_improvement', false, 'manual_review', 0)
ON CONFLICT (policy_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS improvement_reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL UNIQUE REFERENCES product_improvement_suggestions(id) ON DELETE RESTRICT,
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  currency_code CHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','payable','paid','cancelled','reversed')),
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS improvement_reward_ledger_creator_status_idx ON improvement_reward_ledger(creator_user_id, status, created_at DESC);

COMMIT;
