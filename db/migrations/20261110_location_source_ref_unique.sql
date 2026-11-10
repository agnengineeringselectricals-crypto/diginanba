CREATE UNIQUE INDEX IF NOT EXISTS marketplace_locations_source_ref_unique_idx
  ON marketplace_locations (source_name, source_ref)
  WHERE source_name IS NOT NULL AND source_ref IS NOT NULL;
