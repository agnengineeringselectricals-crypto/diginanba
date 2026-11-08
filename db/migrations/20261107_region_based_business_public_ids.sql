-- Preserve the existing DigiNanba mixed/non-sequential region ID allocator.
-- Shop registration calls allocate_marketplace_public_id(region_code) explicitly.
-- This migration only enforces that assigned public IDs and their region are immutable.
BEGIN;

-- Ensure the columns exist even when migrations are applied in filename order.
ALTER TABLE marketplace_businesses
  ADD COLUMN IF NOT EXISTS region_code CHAR(2),
  ADD COLUMN IF NOT EXISTS public_id VARCHAR(8);

DROP TRIGGER IF EXISTS marketplace_business_public_id_guard ON marketplace_businesses;
DROP FUNCTION IF EXISTS diginanba_set_business_public_id();
DROP FUNCTION IF EXISTS diginanba_next_business_public_id(TEXT);
DROP TABLE IF EXISTS marketplace_business_id_counters;

CREATE OR REPLACE FUNCTION diginanba_prevent_business_public_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'DigiNanba public IDs are permanent and cannot be changed';
  END IF;
  IF NEW.region_code IS DISTINCT FROM OLD.region_code THEN
    RAISE EXCEPTION 'A shop region cannot be changed after its public ID is assigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_business_public_id_immutable ON marketplace_businesses;
CREATE TRIGGER marketplace_business_public_id_immutable
BEFORE UPDATE OF public_id, region_code ON marketplace_businesses
FOR EACH ROW
WHEN (OLD.public_id IS NOT NULL)
EXECUTE FUNCTION diginanba_prevent_business_public_id_change();

COMMIT;
