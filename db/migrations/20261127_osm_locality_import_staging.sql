-- Staging layer for fresh OpenStreetMap locality imports.
-- OSM-derived records remain isolated from the live marketplace search until
-- reconciled against LGD/Survey of India and reviewed for hierarchy quality.
BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_locality_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL DEFAULT 'OpenStreetMap',
  extract_url text NOT NULL,
  extract_date date,
  source_license text NOT NULL DEFAULT 'ODbL 1.0',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed')),
  input_features bigint NOT NULL DEFAULT 0,
  imported_features bigint NOT NULL DEFAULT 0,
  rejected_features bigint NOT NULL DEFAULT 0,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_locality_import_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES marketplace_locality_import_batches(id) ON DELETE RESTRICT,
  source_ref text NOT NULL UNIQUE,
  osm_type text NOT NULL CHECK (osm_type IN ('node','way','relation')),
  osm_id bigint NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  location_type text NOT NULL CHECK (location_type IN ('city','town','village','hamlet','locality','neighbourhood','suburb','street','road')),
  osm_place_type text,
  highway_class text,
  state_hint text,
  district_hint text,
  subdistrict_hint text,
  parent_hint text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  geom geography(Point,4326),
  raw_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_license text NOT NULL DEFAULT 'ODbL 1.0',
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','accepted','rejected')),
  linked_location_id uuid REFERENCES marketplace_locations(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_locality_import_stage_coordinates_check CHECK (
    (latitude IS NULL AND longitude IS NULL AND geom IS NULL) OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND geom IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS marketplace_locality_stage_name_trgm_idx
  ON marketplace_locality_import_stage USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketplace_locality_stage_aliases_gin_idx
  ON marketplace_locality_import_stage USING gin (aliases);
CREATE INDEX IF NOT EXISTS marketplace_locality_stage_type_idx
  ON marketplace_locality_import_stage (location_type, state_hint, district_hint);
CREATE INDEX IF NOT EXISTS marketplace_locality_stage_postal_idx
  ON marketplace_locality_import_stage (postal_code) WHERE postal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_locality_stage_geom_gist_idx
  ON marketplace_locality_import_stage USING gist (geom);
CREATE INDEX IF NOT EXISTS marketplace_locality_stage_batch_idx
  ON marketplace_locality_import_stage (import_batch_id);

COMMENT ON TABLE marketplace_locality_import_stage IS
  'Isolated OSM locality/street staging. Never read by live suggestions until reviewed and reconciled with official administrative data.';
COMMENT ON TABLE marketplace_locality_import_batches IS
  'Provenance and quality counts for each OSM locality extract import. OSM-derived content is licensed ODbL 1.0.';

COMMIT;
