-- Shop product price protection and Nanba fee foundation.
-- Additive migration: existing product prices and order history remain unchanged.
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS mrp_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS nanba_fee_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS nanba_fee_floor_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS customer_price_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tax_display_mode TEXT NOT NULL DEFAULT 'included'
    CHECK (tax_display_mode IN ('included','not_separately_shown','excluded'));

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_mrp_nonnegative
    CHECK (mrp_amount IS NULL OR mrp_amount >= 0),
  ADD CONSTRAINT marketplace_listings_max_discount_nonnegative
    CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  ADD CONSTRAINT marketplace_listings_nanba_fee_positive
    CHECK (nanba_fee_amount IS NULL OR nanba_fee_amount > 0),
  ADD CONSTRAINT marketplace_listings_nanba_floor_positive
    CHECK (nanba_fee_floor_amount IS NULL OR nanba_fee_floor_amount > 0),
  ADD CONSTRAINT marketplace_listings_customer_price_nonnegative
    CHECK (customer_price_amount IS NULL OR customer_price_amount >= 0),
  ADD CONSTRAINT marketplace_listings_discount_within_mrp
    CHECK (mrp_amount IS NULL OR max_discount_amount IS NULL OR max_discount_amount <= mrp_amount);

CREATE TABLE IF NOT EXISTS marketplace_nanba_fee_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  minimum_fee_amount NUMERIC(14,2) NOT NULL CHECK (minimum_fee_amount > 0),
  minimum_fee_percent NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (minimum_fee_percent >= 0),
  operating_cost_per_order NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (operating_cost_per_order >= 0),
  service_tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (service_tax_rate >= 0),
  enabled BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_code,currency)
);
CREATE INDEX IF NOT EXISTS marketplace_nanba_fee_policies_active_idx
  ON marketplace_nanba_fee_policies(country_code,currency,enabled,effective_from DESC);

COMMENT ON COLUMN marketplace_listings.mrp_amount IS 'Shop-owner supplied maximum retail price; tax inclusive according to local product tax rules where applicable.';
COMMENT ON COLUMN marketplace_listings.max_discount_amount IS 'Shop-owner supplied maximum discount pool, protecting their declared payout floor.';
COMMENT ON COLUMN marketplace_listings.nanba_fee_amount IS 'Server-calculated Nanba fee retained between customer price and protected shop payout; never editable by shop owners.';
COMMENT ON COLUMN marketplace_listings.customer_price_amount IS 'Server-calculated customer-facing price, with Nanba fee included.';
COMMENT ON TABLE marketplace_nanba_fee_policies IS 'Country/currency fee floors and cost/tax parameters. Disabled until reviewed and enabled by platform administration.';
