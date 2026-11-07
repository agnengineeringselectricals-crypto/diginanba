-- Region-based, permanent public IDs for DigiNanba shop/business registrations.
-- Display format: TN-7K9MQ (two-character region code + five Base32 characters).
-- Country remains stored separately for internal uniqueness and regional analytics.
BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_business_id_counters (
  region_code CHAR(2) PRIMARY KEY,
  next_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_business_id_counter_range
    CHECK (next_value >= 0 AND next_value < 33554432)
);

CREATE OR REPLACE FUNCTION diginanba_next_business_public_id(p_region_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_region TEXT := upper(trim(p_region_code));
  v_value BIGINT;
  v_remaining BIGINT;
  v_encoded TEXT := '';
  v_alphabet CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_digit INTEGER;
BEGIN
  IF v_region IS NULL OR v_region !~ '^[A-Z0-9]{2}$' THEN
    RAISE EXCEPTION 'A valid two-character state/region code is required';
  END IF;

  INSERT INTO marketplace_business_id_counters(region_code, next_value)
  VALUES (v_region, 1)
  ON CONFLICT (region_code)
  DO UPDATE SET next_value = marketplace_business_id_counters.next_value + 1,
                updated_at = now()
  RETURNING next_value INTO v_value;

  IF v_value >= 33554432 THEN
    RAISE EXCEPTION 'Public ID capacity exhausted for region %', v_region;
  END IF;

  v_remaining := v_value;
  FOR i IN 1..5 LOOP
    v_digit := (v_remaining % 32)::INTEGER;
    v_encoded := substr(v_alphabet, v_digit + 1, 1) || v_encoded;
    v_remaining := v_remaining / 32;
  END LOOP;

  RETURN v_region || '-' || v_encoded;
END;
$$;

CREATE OR REPLACE FUNCTION diginanba_set_business_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.region_code IS NULL OR length(trim(NEW.region_code::TEXT)) <> 2 THEN
      RAISE EXCEPTION 'Select a state/region before registering a DigiNanba shop';
    END IF;
    NEW.region_code := upper(trim(NEW.region_code::TEXT));
    NEW.public_id := diginanba_next_business_public_id(NEW.region_code::TEXT);
    RETURN NEW;
  END IF;

  IF OLD.public_id IS NOT NULL AND
     (NEW.public_id IS DISTINCT FROM OLD.public_id OR
      NEW.region_code IS DISTINCT FROM OLD.region_code) THEN
    RAISE EXCEPTION 'DigiNanba public IDs and their region codes are permanent and cannot be edited';
  END IF;

  IF OLD.public_id IS NULL AND NEW.public_id IS NULL THEN
    IF NEW.region_code IS NULL OR length(trim(NEW.region_code::TEXT)) <> 2 THEN
      RAISE EXCEPTION 'A valid state/region code is required to assign a public ID';
    END IF;
    NEW.region_code := upper(trim(NEW.region_code::TEXT));
    NEW.public_id := diginanba_next_business_public_id(NEW.region_code::TEXT);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_business_public_id_guard ON marketplace_businesses;
CREATE TRIGGER marketplace_business_public_id_guard
BEFORE INSERT OR UPDATE OF public_id, region_code ON marketplace_businesses
FOR EACH ROW EXECUTE FUNCTION diginanba_set_business_public_id();

-- Backfill only records without a public ID. Existing business data and UUIDs are preserved.
UPDATE marketplace_businesses
SET public_id = diginanba_next_business_public_id(region_code::TEXT)
WHERE public_id IS NULL
  AND region_code IS NOT NULL
  AND length(trim(region_code::TEXT)) = 2;

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_businesses_public_id_uidx
  ON marketplace_businesses(public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketplace_businesses_region_country_idx
  ON marketplace_businesses(country_code, region_code);

COMMIT;
