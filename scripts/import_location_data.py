#!/usr/bin/env python3
"""Import India GeoNames gazetteer and OpenStreetMap place/street names into DigiNanba PostGIS.

Run with:
  pip install "psycopg[binary]" pyosmium
  NEON_DATABASE_URL='postgresql://...' python scripts/import_location_data.py --include-osm

The importer downloads source extracts itself, batches inserts, and upserts by source ID.
"""
from __future__ import annotations

import argparse
import os
import re
import unicodedata
import urllib.request
import uuid
import zipfile
from pathlib import Path
from typing import Iterable

import psycopg

NAMESPACE = uuid.UUID("fbf13e5a-9cb9-4c2e-83b7-25e9f4d07a91")
BATCH_SIZE = 1500
INSERT_SQL = """
INSERT INTO marketplace_locations
(id,parent_id,country_code,location_type,name,normalized_name,aliases,postal_code,
 latitude,longitude,geom,source_name,source_ref,source_license,source_updated_at)
VALUES
(%s,%s,'IN',%s,%s,%s,%s,%s,%s,%s,
 CASE WHEN %s IS NULL OR %s IS NULL THEN NULL
      ELSE ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography END,
 %s,%s,%s,now())
ON CONFLICT (source_name,source_ref)
WHERE source_name IS NOT NULL AND source_ref IS NOT NULL
DO UPDATE SET
 parent_id=COALESCE(EXCLUDED.parent_id,marketplace_locations.parent_id),
 location_type=EXCLUDED.location_type,
 name=EXCLUDED.name,
 normalized_name=EXCLUDED.normalized_name,
 aliases=EXCLUDED.aliases,
 postal_code=COALESCE(EXCLUDED.postal_code,marketplace_locations.postal_code),
 latitude=COALESCE(EXCLUDED.latitude,marketplace_locations.latitude),
 longitude=COALESCE(EXCLUDED.longitude,marketplace_locations.longitude),
 geom=COALESCE(EXCLUDED.geom,marketplace_locations.geom),
 source_license=EXCLUDED.source_license,
 source_updated_at=now(),
 is_active=true
"""

def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", value.casefold()).strip()

def gid(source: str, ref: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{source}:{ref}")

def download(url: str, path: Path) -> Path:
    if path.exists() and path.stat().st_size > 0:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}", flush=True)
    request = urllib.request.Request(url, headers={"User-Agent": "DigiNanbaLocationImporter/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response, path.open("wb") as output:
        total = int(response.headers.get("Content-Length", "0") or 0)
        done = 0
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {done * 100 // total}% ({done:,}/{total:,} bytes)", end="", flush=True)
    print("", flush=True)
    return path

def batched(rows: Iterable[tuple], size: int = BATCH_SIZE):
    batch = []
    for row in rows:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch

def db_row(location_id, parent_id, kind, name, aliases, postal, lat, lon,
           source, source_ref, license_name):
    if not name or not name.strip():
        return None
    aliases = list(dict.fromkeys(a.strip() for a in aliases if a and a.strip() and a.strip() != name.strip()))[:20]
    return (
        location_id, parent_id, kind, name.strip(), norm(name), aliases, postal or None,
        lat, lon, lat, lon, lon, lat, source, source_ref, license_name,
    )

def insert_rows(conn, rows: Iterable[tuple], label: str):
    total = 0
    with conn.cursor() as cur:
        for batch in batched(row for row in rows if row):
            cur.executemany(INSERT_SQL, batch)
            conn.commit()
            total += len(batch)
            print(f"{label}: upserted {total:,} rows", flush=True)
    return total

def load_geonames(conn, data_dir: Path):
    zip_path = download("https://download.geonames.org/export/dump/IN.zip", data_dir / "geonames-IN.zip")
    admin1_path = download("https://download.geonames.org/export/dump/admin1CodesASCII.txt", data_dir / "admin1CodesASCII.txt")
    admin2_path = download("https://download.geonames.org/export/dump/admin2Codes.txt", data_dir / "admin2Codes.txt")

    state_ids: dict[str, uuid.UUID] = {}
    district_ids: dict[str, uuid.UUID] = {}
    rows = []

    with admin1_path.open(encoding="utf-8") as f:
        for line in f:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 4 or not fields[0].startswith("IN."):
                continue
            code, name, ascii_name, geoname_id = fields[:4]
            location_id = gid("geonames", geoname_id)
            state_ids[code] = location_id
            rows.append(db_row(location_id, None, "state", ascii_name or name, [name], None, None, None,
                               "GeoNames", f"geoname:{geoname_id}", "CC BY 4.0"))

    with admin2_path.open(encoding="utf-8") as f:
        for line in f:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 4 or not fields[0].startswith("IN."):
                continue
            code, name, ascii_name, geoname_id = fields[:4]
            parts = code.split(".")
            parent = state_ids.get(".".join(parts[:2]))
            location_id = gid("geonames", geoname_id)
            district_ids[code] = location_id
            rows.append(db_row(location_id, parent, "district", ascii_name or name, [name], None, None, None,
                               "GeoNames", f"geoname:{geoname_id}", "CC BY 4.0"))
    insert_rows(conn, rows, "GeoNames administrative divisions")

    def place_rows():
        with zipfile.ZipFile(zip_path) as archive:
            member = next(n for n in archive.namelist() if n.endswith("IN.txt"))
            with archive.open(member) as raw:
                for raw_line in raw:
                    fields = raw_line.decode("utf-8").rstrip("\n").split("\t")
                    if len(fields) < 19 or fields[7] != "P":
                        continue
                    geoname_id, name, ascii_name, alternates = fields[:4]
                    lat, lon = fields[4], fields[5]
                    feature_code, admin1, admin2 = fields[7], fields[8], fields[10]
                    # Correct the field offsets to GeoNames schema:
                    # 6=feature class, 7=feature code, 8=country, 10=admin1, 11=admin2.
                    feature_code = fields[7]
                    if feature_code not in {"PPL","PPLA","PPLA2","PPLA3","PPLA4","PPLA5","PPLC","PPLG","PPLQ","PPLR","PPLS","PPLX"}:
                        continue
                    if feature_code == "PPLX":
                        kind = "locality"
                    elif feature_code.startswith("PPLA") or feature_code == "PPLC":
                        kind = "city"
                    else:
                        kind = "town"
                    admin1_code = f"IN.{fields[10]}" if fields[10] else ""
                    admin2_code = f"{admin1_code}.{fields[11]}" if fields[11] else ""
                    parent = district_ids.get(admin2_code) or state_ids.get(admin1_code)
                    try:
                        latitude, longitude = float(lat), float(lon)
                    except ValueError:
                        latitude = longitude = None
                    aliases = (alternates or "").split(",")[:20]
                    yield db_row(gid("geonames", geoname_id), parent, kind, ascii_name or name,
                                 aliases + ([name] if name != ascii_name else []), None,
                                 latitude, longitude, "GeoNames", f"geoname:{geoname_id}", "CC BY 4.0")
    insert_rows(conn, place_rows(), "GeoNames populated places")

def load_osm(conn, pbf_path: Path):
    try:
        import osmium
    except ImportError as exc:
        raise SystemExit("Install pyosmium to import OpenStreetMap data: pip install pyosmium") from exc

    with conn.cursor() as cur:
        cur.execute("SELECT id, normalized_name, location_type FROM marketplace_locations WHERE country_code='IN' AND is_active")
        known = {(kind, name): location_id for location_id, name, kind in cur.fetchall()}
    rows = []

    class Handler(osmium.SimpleHandler):
        def flush(self):
            nonlocal rows
            if rows:
                insert_rows(conn, rows, "OpenStreetMap")
                rows = []

        def add_feature(self, obj, kind, name, aliases, lat=None, lon=None):
            tags = obj.tags
            city_name = tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village")
            parent = known.get(("city", norm(city_name))) or known.get(("town", norm(city_name)))
            source_ref = f"{obj.__class__.__name__.lower()}/{obj.id}"
            row = db_row(gid("osm", source_ref), parent, kind, name, aliases, tags.get("addr:postcode"),
                         lat, lon, "OpenStreetMap", source_ref, "ODbL 1.0")
            if row:
                rows.append(row)
                if len(rows) >= BATCH_SIZE:
                    self.flush()

        def node(self, node):
            place = node.tags.get("place", "")
            kind_map = {"city":"city","town":"town","village":"village","hamlet":"hamlet",
                        "suburb":"suburb","neighbourhood":"neighbourhood","quarter":"locality",
                        "locality":"locality","isolated_dwelling":"hamlet"}
            kind = kind_map.get(place)
            name = node.tags.get("name") or node.tags.get("name:en")
            if kind and name and node.location.valid():
                aliases = [node.tags.get(k) for k in ("alt_name","official_name","short_name","old_name","name:ta","name:hi")]
                self.add_feature(node, kind, name, aliases, node.location.lat, node.location.lon)

        def way(self, way):
            name = way.tags.get("name") or way.tags.get("name:en")
            highway = way.tags.get("highway", "")
            if not name or highway not in {"residential","living_street","unclassified","service",
                    "tertiary","tertiary_link","secondary","secondary_link","primary","primary_link",
                    "trunk","trunk_link","pedestrian"}:
                return
            kind = "street" if highway in {"residential","living_street","service","pedestrian"} else "road"
            aliases = [way.tags.get(k) for k in ("alt_name","official_name","short_name","old_name","name:ta")]
            self.add_feature(way, kind, name, aliases)

    handler = Handler()
    handler.apply_file(str(pbf_path), locations=False)
    handler.flush()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default=".location-data")
    parser.add_argument("--include-osm", action="store_true", help="Also download and import the full India OSM PBF (about 1.7 GB).")
    parser.add_argument("--osm-file", help="Use an already downloaded OSM PBF instead of downloading it.")
    args = parser.parse_args()
    database_url = os.environ.get("NEON_DATABASE_URL")
    if not database_url:
        raise SystemExit("Set NEON_DATABASE_URL to the DigiNanba Neon PostgreSQL connection string.")
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    with psycopg.connect(database_url, autocommit=False) as conn:
        load_geonames(conn, data_dir)
        if args.include_osm or args.osm_file:
            pbf_path = Path(args.osm_file) if args.osm_file else download(
                "https://download.geofabrik.de/asia/india-latest.osm.pbf", data_dir / "india-latest.osm.pbf")
            load_osm(conn, pbf_path)
    print("Location import finished. Check row counts and run autocomplete smoke tests.", flush=True)

if __name__ == "__main__":
    main()
