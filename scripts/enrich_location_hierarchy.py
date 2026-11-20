#!/usr/bin/env python3
"""Safely enrich orphaned OpenStreetMap place records from GeoNames hierarchy.

Default mode is read-only and reports eligible matches. Pass --apply to attach
an OSM place to its uniquely matched GeoNames place only when the normalized
name and country match exactly, both points are within the configured distance
in metres, and the GeoNames place already has a verified parent.

The matched GeoNames place itself becomes the OSM record's parent. Its own
parent chain then supplies town/city, district, state/region and country in
marketplace_location_search. Existing parent links are never overwritten.
Run with NEON_DATABASE_URL set.
"""
from __future__ import annotations

import argparse
import os
import sys

import psycopg
from psycopg.rows import dict_row

MATCH_CTE = """
WITH matches AS (
    SELECT
        osm.id AS osm_id,
        osm.country_code,
        osm.location_type,
        geo.id AS geonames_id,
        geo.parent_id AS geonames_parent_id,
        ST_Distance(osm.geom::geography, geo.geom::geography) AS distance_m,
        COUNT(*) OVER (PARTITION BY osm.id) AS candidate_count
    FROM marketplace_locations AS osm
    JOIN marketplace_locations AS geo
      ON geo.is_active
     AND geo.source_name = 'GeoNames'
     AND geo.country_code = osm.country_code
     AND geo.normalized_name = osm.normalized_name
     AND geo.geom IS NOT NULL
     AND ST_DWithin(
           osm.geom::geography,
           geo.geom::geography,
           %(max_distance_m)s
         )
    WHERE osm.is_active
      AND osm.source_name = 'OpenStreetMap'
      AND osm.parent_id IS NULL
      AND osm.geom IS NOT NULL
      AND osm.location_type IN (
          'village', 'hamlet', 'town', 'city',
          'locality', 'neighbourhood', 'neighborhood', 'suburb'
      )
),
safe_matches AS (
    SELECT osm_id, country_code, location_type, geonames_id, distance_m
    FROM matches
    WHERE candidate_count = 1
      AND geonames_parent_id IS NOT NULL
)
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-distance-m", type=int, default=1000,
        help="Maximum distance between exact-name OSM and GeoNames points in metres (default: 1000).",
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Apply uniquely matched parent links. Without this flag, no data is changed.",
    )
    args = parser.parse_args()

    if args.max_distance_m < 1 or args.max_distance_m > 5000:
        parser.error("--max-distance-m must be between 1 and 5000.")

    database_url = os.environ.get("NEON_DATABASE_URL")
    if not database_url:
        print("Set NEON_DATABASE_URL to the DigiNanba Neon PostgreSQL connection string.", file=sys.stderr)
        return 2

    params = {"max_distance_m": args.max_distance_m}
    summary_sql = MATCH_CTE + """
    SELECT country_code, location_type, COUNT(*)::bigint AS eligible_records,
           ROUND(AVG(distance_m))::bigint AS average_distance_m,
           MAX(ROUND(distance_m))::bigint AS maximum_distance_m
    FROM safe_matches
    GROUP BY country_code, location_type
    ORDER BY eligible_records DESC, country_code, location_type
    """
    total_sql = MATCH_CTE + """
    SELECT COUNT(*)::bigint AS eligible_records
    FROM safe_matches
    """
    apply_sql = MATCH_CTE + """
    UPDATE marketplace_locations AS osm
       SET parent_id = safe.geonames_id,
           updated_at = now()
      FROM safe_matches AS safe
     WHERE osm.id = safe.osm_id
       AND osm.parent_id IS NULL
    RETURNING osm.id
    """

    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        total = conn.execute(total_sql, params).fetchone()["eligible_records"]
        print(f"Unique exact-name matches within {args.max_distance_m} metres: {total:,}")
        for row in conn.execute(summary_sql, params).fetchall():
            print(
                f"  {row['country_code']} / {row['location_type']}: "
                f"{row['eligible_records']:,} "
                f"(average {row['average_distance_m']}m; "
                f"maximum {row['maximum_distance_m']}m)"
            )

        if not args.apply:
            print("DRY RUN ONLY — no database records were changed.")
            return 0

        with conn.transaction():
            changed = conn.execute(apply_sql, params).fetchall()
        print(f"Applied parent links: {len(changed):,}")
        print("The existing projection-sync trigger refreshes the complete parent hierarchy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
