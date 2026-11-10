-- Verified locality seed for DigiNanba's own PostGIS location directory.
-- Subramaniyapuram / Subramaniyapuram suburb in Tiruchirappalli.
-- OSM feature: node/6507644593, ODbL 1.0; coordinates from that OSM feature.
-- GeoNames city: geoname:1254388, CC BY 4.0.
WITH seed(id,parent_id,country_code,location_type,name,normalized_name,aliases,postal_code,latitude,longitude,source_name,source_ref,source_license) AS (
  VALUES
  ('10000000-0000-4000-8000-000000000001'::uuid,NULL::uuid,'IN','state','Tamil Nadu','tamil nadu',ARRAY['Tamilnadu']::text[],NULL::text,NULL::float8,NULL::float8,'GeoNames','IN.ADM1.25','CC BY 4.0'),
  ('10000000-0000-4000-8000-000000000002'::uuid,'10000000-0000-4000-8000-000000000001'::uuid,'IN','district','Tiruchirappalli','tiruchirappalli',ARRAY['Trichy District']::text[],NULL::text,NULL::float8,NULL::float8,'GeoNames','IN.ADM2.614','CC BY 4.0'),
  ('10000000-0000-4000-8000-000000000003'::uuid,'10000000-0000-4000-8000-000000000002'::uuid,'IN','city','Tiruchirappalli','tiruchirappalli',ARRAY['Trichy','Tiruchi','Trichinopoly']::text[],NULL::text,10.81550::float8,78.69651::float8,'GeoNames','geoname:1254388','CC BY 4.0'),
  ('10000000-0000-4000-8000-000000000004'::uuid,'10000000-0000-4000-8000-000000000003'::uuid,'IN','suburb','Subramaniyapuram','subramaniyapuram',ARRAY['Subramanyapuram','Subramaniapuram','Subramanya Puram']::text[],'620020'::text,10.78617::float8,78.70177::float8,'OpenStreetMap','node/6507644593','ODbL 1.0')
)
INSERT INTO marketplace_locations
(id,parent_id,country_code,location_type,name,normalized_name,aliases,postal_code,latitude,longitude,geom,source_name,source_ref,source_license,source_updated_at)
SELECT id,parent_id,country_code,location_type,name,normalized_name,aliases,postal_code,latitude,longitude,
       CASE WHEN latitude IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography END,
       source_name,source_ref,source_license,now()
FROM seed
ON CONFLICT (source_name,source_ref)
WHERE source_name IS NOT NULL AND source_ref IS NOT NULL
DO UPDATE SET parent_id=EXCLUDED.parent_id,name=EXCLUDED.name,normalized_name=EXCLUDED.normalized_name,
              aliases=EXCLUDED.aliases,postal_code=EXCLUDED.postal_code,latitude=EXCLUDED.latitude,
              longitude=EXCLUDED.longitude,geom=EXCLUDED.geom,source_license=EXCLUDED.source_license,
              source_updated_at=now(),is_active=true;
