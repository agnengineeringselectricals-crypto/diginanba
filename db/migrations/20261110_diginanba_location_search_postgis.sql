-- DigiNanba-owned geographic search foundation.
-- Applied to Neon production on 2026-11-10 after testing on a temporary branch.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS marketplace_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES marketplace_locations(id) ON DELETE SET NULL,
  country_code char(2) NOT NULL,
  admin_level smallint,
  location_type text NOT NULL CHECK (location_type IN ('country','state','district','city','town','village','hamlet','locality','neighbourhood','suburb','street','road','postal_code','other')),
  name text NOT NULL,
  normalized_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  postal_code text,
  latitude double precision,
  longitude double precision,
  geom geography(Point,4326),
  source_name text,
  source_ref text,
  source_license text,
  source_updated_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_locations_coordinates_check CHECK (
    (latitude IS NULL AND longitude IS NULL AND geom IS NULL) OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND geom IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS marketplace_locations_name_trgm_idx
  ON marketplace_locations USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketplace_locations_aliases_gin_idx
  ON marketplace_locations USING gin (aliases);
CREATE INDEX IF NOT EXISTS marketplace_locations_parent_type_idx
  ON marketplace_locations (parent_id, location_type, normalized_name);
CREATE INDEX IF NOT EXISTS marketplace_locations_country_type_idx
  ON marketplace_locations (country_code, location_type, normalized_name);
CREATE INDEX IF NOT EXISTS marketplace_locations_postal_code_idx
  ON marketplace_locations (postal_code) WHERE postal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_locations_geom_gist_idx
  ON marketplace_locations USING gist (geom);
