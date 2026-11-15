-- DigiNanba Option C: additive, denormalized location autocomplete projection.
-- Source of truth remains marketplace_locations. This migration does not rewrite
-- or delete source locations or shop records. Backfill is performed separately.
BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_location_search (
  location_id uuid PRIMARY KEY REFERENCES marketplace_locations(id) ON DELETE CASCADE,
  country_code char(2) NOT NULL,
  location_type text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  normalized_aliases text[] NOT NULL DEFAULT '{}',
  city text,
  town text,
  village text,
  district text,
  state text,
  country text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  search_document text NOT NULL DEFAULT '',
  source_updated_at timestamptz,
  projected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_location_search_name_trgm_idx
  ON marketplace_location_search USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketplace_location_search_document_trgm_idx
  ON marketplace_location_search USING gin (search_document gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketplace_location_search_aliases_gin_idx
  ON marketplace_location_search USING gin (normalized_aliases);
CREATE INDEX IF NOT EXISTS marketplace_location_search_country_type_idx
  ON marketplace_location_search (country_code, location_type);
CREATE INDEX IF NOT EXISTS marketplace_location_search_postal_idx
  ON marketplace_location_search (country_code, postal_code)
  WHERE postal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_location_search_projected_at_idx
  ON marketplace_location_search (projected_at);

COMMENT ON TABLE marketplace_location_search IS
  'Additive autocomplete projection. marketplace_locations remains authoritative; backfill and validate before switching API reads.';

COMMIT;
