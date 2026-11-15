-- Keep the denormalized autocomplete projection current for future imports and edits.
BEGIN;

CREATE OR REPLACE FUNCTION sync_marketplace_location_search_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM marketplace_location_search WHERE location_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NOT NEW.is_active THEN
    DELETE FROM marketplace_location_search WHERE location_id = NEW.id;
    RETURN NEW;
  END IF;

  WITH RECURSIVE ancestry AS (
    SELECT id,parent_id,name,location_type,0 AS depth
    FROM marketplace_locations WHERE id=NEW.id
    UNION ALL
    SELECT p.id,p.parent_id,p.name,p.location_type,a.depth+1
    FROM ancestry a
    JOIN marketplace_locations p ON p.id=a.parent_id
    WHERE a.depth<8
  ),
  hierarchy AS (
    SELECT
      max(name) FILTER (WHERE location_type='city') AS city,
      max(name) FILTER (WHERE location_type='town') AS town,
      max(name) FILTER (WHERE location_type='village') AS village,
      max(name) FILTER (WHERE location_type='district') AS district,
      max(name) FILTER (WHERE location_type='state') AS state,
      max(name) FILTER (WHERE location_type='country') AS country
    FROM ancestry
  )
  INSERT INTO marketplace_location_search (
    location_id,country_code,location_type,name,normalized_name,normalized_aliases,
    city,town,village,district,state,country,postal_code,latitude,longitude,
    search_document,source_updated_at,projected_at
  )
  SELECT NEW.id,NEW.country_code,NEW.location_type,NEW.name,NEW.normalized_name,
    ARRAY(
      SELECT DISTINCT lower(unaccent(trim(alias_value)))
      FROM unnest(COALESCE(NEW.aliases,ARRAY[]::text[])) AS alias_value
      WHERE trim(alias_value)<>''
    ),
    h.city,h.town,h.village,h.district,h.state,h.country,
    NEW.postal_code,NEW.latitude,NEW.longitude,
    lower(unaccent(concat_ws(' ',NEW.name,array_to_string(NEW.aliases,' '),
      h.city,h.town,h.village,h.district,h.state,h.country,NEW.postal_code))),
    NEW.source_updated_at,now()
  FROM hierarchy h
  ON CONFLICT (location_id) DO UPDATE SET
    country_code=EXCLUDED.country_code,
    location_type=EXCLUDED.location_type,
    name=EXCLUDED.name,
    normalized_name=EXCLUDED.normalized_name,
    normalized_aliases=EXCLUDED.normalized_aliases,
    city=EXCLUDED.city,
    town=EXCLUDED.town,
    village=EXCLUDED.village,
    district=EXCLUDED.district,
    state=EXCLUDED.state,
    country=EXCLUDED.country,
    postal_code=EXCLUDED.postal_code,
    latitude=EXCLUDED.latitude,
    longitude=EXCLUDED.longitude,
    search_document=EXCLUDED.search_document,
    source_updated_at=EXCLUDED.source_updated_at,
    projected_at=now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_locations_sync_search_projection
  ON marketplace_locations;
CREATE TRIGGER marketplace_locations_sync_search_projection
AFTER INSERT OR UPDATE OF parent_id,country_code,location_type,name,normalized_name,aliases,
  postal_code,latitude,longitude,source_updated_at,is_active
ON marketplace_locations
FOR EACH ROW
EXECUTE FUNCTION sync_marketplace_location_search_projection();

COMMIT;
