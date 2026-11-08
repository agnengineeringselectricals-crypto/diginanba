-- Extend internal Nanba fee policy for auditable cost recovery and demand-aware discounting.
ALTER TABLE marketplace_nanba_fee_policies
  ADD COLUMN IF NOT EXISTS api_cost_per_order NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (api_cost_per_order >= 0),
  ADD COLUMN IF NOT EXISTS database_cost_per_order NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (database_cost_per_order >= 0),
  ADD COLUMN IF NOT EXISTS hosting_cost_per_order NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (hosting_cost_per_order >= 0),
  ADD COLUMN IF NOT EXISTS target_profit_per_order NUMERIC(14,2) NOT NULL DEFAULT 10 CHECK (target_profit_per_order >= 0),
  ADD COLUMN IF NOT EXISTS discount_capture_ratio NUMERIC(7,4) NOT NULL DEFAULT 1 CHECK (discount_capture_ratio >= 0 AND discount_capture_ratio <= 1);

INSERT INTO marketplace_nanba_fee_policies
  (country_code,currency,minimum_fee_amount,minimum_fee_percent,operating_cost_per_order,
   api_cost_per_order,database_cost_per_order,hosting_cost_per_order,target_profit_per_order,
   service_tax_rate,discount_capture_ratio,enabled)
VALUES ('IN','INR',10,0,0,0,0,0,10,0,1,false)
ON CONFLICT(country_code,currency) DO NOTHING;
