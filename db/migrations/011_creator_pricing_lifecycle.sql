-- Additional creator lifecycle and pricing fields for product request records.
-- This is additive; existing request records remain intact.
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS design_finalized_at TIMESTAMPTZ;
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS creator_currency_code CHAR(3);
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS creator_price_minor BIGINT;
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS maintenance_cost_estimate_minor BIGINT;
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS pricing_status TEXT NOT NULL DEFAULT 'locked_until_design_finalized';
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS creator_net_estimate_minor BIGINT;
ALTER TABLE product_customization_requests ADD COLUMN IF NOT EXISTS digi_nanba_share_basis_points INTEGER NOT NULL DEFAULT 5000;
CREATE INDEX IF NOT EXISTS product_customization_requests_pricing_status_idx ON product_customization_requests(pricing_status, created_at DESC);
