-- Supplemental creator workflow tables. Additive and safe to apply repeatedly.
BEGIN;
CREATE TABLE IF NOT EXISTS marketplace_fee_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  platform_fee_basis_points INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_basis_points BETWEEN 0 AND 10000),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
INSERT INTO marketplace_fee_policies(policy_key, enabled, platform_fee_basis_points)
VALUES ('default_creator_commission', false, 0)
ON CONFLICT (policy_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS product_publication_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_build_id UUID REFERENCES product_builds(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','in_review','approved','rejected','changes_requested','withdrawn')),
  reviewer_notes TEXT,
  checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_publication_reviews_queue_idx
  ON product_publication_reviews(status, submitted_at);

CREATE TABLE IF NOT EXISTS product_runtime_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_build_id UUID NOT NULL REFERENCES product_builds(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_name TEXT NOT NULL DEFAULT 'My workspace',
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_runtime_records_user_product_updated_idx
  ON product_runtime_records(user_id, product_id, updated_at DESC);
COMMIT;
