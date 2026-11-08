-- Shop fulfilment preferences are owner-controlled; delivery is opt-in per shop.
ALTER TABLE marketplace_businesses
  ADD COLUMN IF NOT EXISTS door_delivery_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_collection_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_service_area JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_time_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(default_delivery_fee>=0);
