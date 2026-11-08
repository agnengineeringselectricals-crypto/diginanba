-- Delivery partner and rider management foundation.
-- Supports individual couriers and registered logistics companies; no external
-- tracking provider or payment collection is activated by this schema.
CREATE TABLE IF NOT EXISTS marketplace_delivery_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('individual','company','existing_courier')),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  country_code CHAR(2) NOT NULL,
  region TEXT,
  district TEXT,
  city TEXT,
  service_area JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','in_review','verified','rejected','suspended')),
  partner_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (partner_status IN ('pending','active','paused','suspended','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id,display_name)
);
CREATE INDEX IF NOT EXISTS marketplace_delivery_partners_owner_idx ON marketplace_delivery_partners(owner_user_id);
CREATE INDEX IF NOT EXISTS marketplace_delivery_partners_area_idx ON marketplace_delivery_partners(country_code,region,district,city,partner_status);

CREATE TABLE IF NOT EXISTS marketplace_delivery_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES marketplace_delivery_partners(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'two_wheeler'
    CHECK (vehicle_type IN ('walking','bicycle','two_wheeler','three_wheeler','four_wheeler','van','truck','other')),
  vehicle_registration TEXT,
  agent_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (agent_status IN ('pending','available','busy','offline','suspended')),
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_delivery_agents_partner_idx ON marketplace_delivery_agents(partner_id,agent_status);

CREATE TABLE IF NOT EXISTS marketplace_delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_request_id UUID NOT NULL REFERENCES marketplace_shop_order_requests(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES marketplace_delivery_partners(id),
  agent_id UUID REFERENCES marketplace_delivery_agents(id),
  assigned_by_user_id UUID REFERENCES users(id),
  pickup_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  dropoff_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_fee NUMERIC(14,2) NOT NULL CHECK (delivery_fee >= 0),
  partner_fee_amount NUMERIC(14,2) NOT NULL CHECK (partner_fee_amount > 0),
  currency CHAR(3) NOT NULL,
  assignment_status TEXT NOT NULL DEFAULT 'offered'
    CHECK (assignment_status IN ('offered','accepted','picked_up','in_transit','delivered','failed','cancelled')),
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  proof_of_delivery JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_delivery_assignments_partner_idx ON marketplace_delivery_assignments(partner_id,assignment_status,created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_delivery_assignments_agent_idx ON marketplace_delivery_assignments(agent_id,assignment_status);

CREATE TABLE IF NOT EXISTS marketplace_delivery_location_events (
  id BIGSERIAL PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES marketplace_delivery_assignments(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES marketplace_delivery_agents(id),
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m NUMERIC(10,2),
  source TEXT NOT NULL DEFAULT 'partner_api',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_delivery_location_events_assignment_idx ON marketplace_delivery_location_events(assignment_id,recorded_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_delivery_api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES marketplace_delivery_partners(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['delivery:read','delivery:update'],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_delivery_api_credentials_partner_idx ON marketplace_delivery_api_credentials(partner_id,created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_delivery_fee_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  partner_fee_percent NUMERIC(7,4) NOT NULL CHECK (partner_fee_percent > 0 AND partner_fee_percent <= 100),
  minimum_partner_fee NUMERIC(14,2) NOT NULL CHECK (minimum_partner_fee > 0),
  location_tracking_cost_per_job NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (location_tracking_cost_per_job >= 0),
  api_cost_per_job NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (api_cost_per_job >= 0),
  operating_cost_per_job NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (operating_cost_per_job >= 0),
  target_profit_per_job NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (target_profit_per_job >= 0),
  service_tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (service_tax_rate >= 0),
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_code,currency)
);
CREATE TABLE IF NOT EXISTS marketplace_delivery_partner_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES marketplace_delivery_partners(id),
  assignment_id UUID NOT NULL UNIQUE REFERENCES marketplace_delivery_assignments(id),
  delivery_fee NUMERIC(14,2) NOT NULL CHECK (delivery_fee >= 0),
  platform_fee_amount NUMERIC(14,2) NOT NULL CHECK (platform_fee_amount > 0),
  partner_net_amount NUMERIC(14,2) NOT NULL CHECK (partner_net_amount >= 0),
  currency CHAR(3) NOT NULL,
  settlement_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (settlement_status IN ('pending','eligible','processing','paid','failed','reversed')),
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS marketplace_delivery_partner_settlements_idx ON marketplace_delivery_partner_settlements(partner_id,settlement_status,created_at DESC);
