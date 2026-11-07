-- DigiNanba compact regional public IDs and customer-led shop onboarding.
-- Additive migration. Apply to the intended preview database before runtime testing.

CREATE TABLE IF NOT EXISTS marketplace_public_id_counters (
  region_code CHAR(2) PRIMARY KEY,
  next_value BIGINT NOT NULL DEFAULT 1 CHECK (next_value > 0)
);

CREATE OR REPLACE FUNCTION allocate_marketplace_public_id(p_region_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_region TEXT := upper(trim(p_region_code));
  v_number BIGINT;
  v_value BIGINT;
  v_alphabet CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_suffix TEXT := '';
  v_digit INTEGER;
BEGIN
  IF v_region !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'A valid two-letter region code is required';
  END IF;

  INSERT INTO marketplace_public_id_counters(region_code, next_value)
  VALUES (v_region, 2)
  ON CONFLICT (region_code)
  DO UPDATE SET next_value = marketplace_public_id_counters.next_value + 1
  RETURNING next_value - 1 INTO v_number;

  IF v_number > 33554432 THEN
    RAISE EXCEPTION 'Public ID capacity reached for region %', v_region;
  END IF;

  v_value := v_number - 1;
  FOR i IN 1..5 LOOP
    v_digit := (v_value % 32)::INTEGER;
    v_suffix := substr(v_alphabet, v_digit + 1, 1) || v_suffix;
    v_value := v_value / 32;
  END LOOP;

  RETURN v_region || '-' || v_suffix;
END;
$$;

ALTER TABLE marketplace_businesses
  ADD COLUMN IF NOT EXISTS region_code CHAR(2),
  ADD COLUMN IF NOT EXISTS public_id VARCHAR(8),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_businesses_public_id_uq
  ON marketplace_businesses(public_id) WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketplace_businesses_public_search_idx
  ON marketplace_businesses(public_id, business_name);

CREATE TABLE IF NOT EXISTS marketplace_shop_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_code TEXT NOT NULL UNIQUE,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_business_id UUID REFERENCES marketplace_businesses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','opened','registered','expired','revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS marketplace_shop_invitations_inviter_idx
  ON marketplace_shop_invitations(inviter_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_regular_shops (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES marketplace_businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, business_id)
);
CREATE INDEX IF NOT EXISTS marketplace_regular_shops_user_idx
  ON marketplace_regular_shops(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_shop_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES marketplace_shop_invitations(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL DEFAULT 'invite'
    CHECK (request_type IN ('invite','discovery_request')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','matched','registered','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_shop_requests_user_idx
  ON marketplace_shop_requests(requester_user_id, created_at DESC);

-- Shops can publish their own basic catalogue immediately after registration.
-- Verification remains a separate, visible trust status and is never implied.
