-- DigiNanba shared platform operating-cost allocation.
-- Stores internal provider bills and internal cost allocation without exposing provider names on customer invoices.
CREATE TABLE IF NOT EXISTS platform_operating_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_category TEXT NOT NULL CHECK (provider_category IN ('ai_api','database','hosting_compute','storage_bandwidth','monitoring_security','other')),
  provider_name TEXT NOT NULL,
  external_invoice_ref TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency_code CHAR(3) NOT NULL,
  notes_internal TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS platform_operating_costs_period_idx
  ON platform_operating_costs(period_start, period_end, provider_category);

CREATE TABLE IF NOT EXISTS platform_cost_allocation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  allocation_method TEXT NOT NULL CHECK (allocation_method IN ('per_job','per_product','revenue_share','fixed_service_fee')),
  allocation_rate NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (allocation_rate >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  customer_facing_label TEXT NOT NULL DEFAULT 'Digital product service',
  internal_description TEXT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_cost_allocation_policies
  (policy_key, enabled, allocation_method, allocation_rate, currency_code, customer_facing_label, internal_description)
VALUES
  ('bundled_platform_operations', false, 'per_product', 0, 'USD', 'Digital product service', 'Internal recovery of attributable platform operating costs; provider categories are not itemized on customer-facing invoices.')
ON CONFLICT (policy_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS product_cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_edition_id UUID REFERENCES product_editions(id) ON DELETE SET NULL,
  job_id UUID REFERENCES product_factory_jobs(id) ON DELETE SET NULL,
  creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  cost_category TEXT NOT NULL CHECK (cost_category IN ('ai_api','database','hosting_compute','storage_bandwidth','monitoring_security','other')),
  actual_cost_minor BIGINT NOT NULL DEFAULT 0 CHECK (actual_cost_minor >= 0),
  allocated_charge_minor BIGINT NOT NULL DEFAULT 0 CHECK (allocated_charge_minor >= 0),
  currency_code CHAR(3) NOT NULL,
  allocation_method TEXT NOT NULL,
  customer_facing_label TEXT NOT NULL DEFAULT 'Digital product service',
  status TEXT NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated','approved','charged','refunded','waived')),
  calculation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_cost_allocations_creator_idx
  ON product_cost_allocations(creator_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_cost_allocations_product_idx
  ON product_cost_allocations(product_id, product_edition_id);
CREATE INDEX IF NOT EXISTS product_cost_allocations_order_idx
  ON product_cost_allocations(order_id);
