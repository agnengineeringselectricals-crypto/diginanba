-- Guided product request briefs from the homepage product builder.
-- Safe to apply repeatedly. Apply this migration in the production Neon database before enabling the expanded request workflow.
CREATE TABLE IF NOT EXISTS product_customization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  visitor_hash TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  request_kind TEXT NOT NULL DEFAULT 'new_product',
  target_market_code TEXT NOT NULL DEFAULT 'IN',
  target_locale TEXT NOT NULL DEFAULT 'en-IN',
  preferred_format TEXT NOT NULL DEFAULT 'not_sure',
  budget_range TEXT NOT NULL DEFAULT 'not_sure',
  requester_role TEXT NOT NULL DEFAULT 'buyer',
  intended_use TEXT NOT NULL DEFAULT 'personal_or_business_use',
  target_audience TEXT NOT NULL DEFAULT '',
  key_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_expectation TEXT NOT NULL DEFAULT 'help_recommend',
  product_kind TEXT NOT NULL DEFAULT 'not_sure',
  request_source TEXT NOT NULL DEFAULT 'customize_page',
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS requester_role TEXT NOT NULL DEFAULT 'buyer';
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS intended_use TEXT NOT NULL DEFAULT 'personal_or_business_use';
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT '';
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS key_features JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS price_expectation TEXT NOT NULL DEFAULT 'help_recommend';
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS product_kind TEXT NOT NULL DEFAULT 'not_sure';
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS request_source TEXT NOT NULL DEFAULT 'customize_page';
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS brief_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS product_customization_requests_status_created_idx ON product_customization_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_customization_requests_requester_created_idx ON product_customization_requests(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS product_customization_requests_visitor_hash_idx ON product_customization_requests(visitor_hash);
