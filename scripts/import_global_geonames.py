#!/usr/bin/env python3
"""Import the worldwide GeoNames country, admin-division and populated-place gazetteer.

Requires psycopg[binary]. Set NEON_DATABASE_URL and run:
  python scripts/import_global_geonames.py

The import is additive/idempotent and preserves existing parent links when GeoNames
does not provide a parent. GeoNames data is licensed CC BY 4.0.
"""
from __future__ import annotations

import os
import re
import unicodedata
import urllib.request
import uuid
import zipfile
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from pathlib import Path

import psycopg

NAMESPACE = uuid.UUID("fbf13e5a-9cb9-4c2e-83b7-25e9f4d07a91")
DATA_DIR = Path(os.environ.get("LOCATION_DATA_DIR", ".location-data"))
BATCH_SIZE = 1200

INSERT_SQL = """
INSERT INTO marketplace_locations
(id,parent_id,country_code,location_type,name,normalized_name,aliases,postal_code,
 latitude,longitude,geom,source_name,source_ref,source_license,source_updated_at)
VALUES
(%s::uuid,%s::uuid,%s::char(2),%s::text,%s::text,%s::text,%s::text[],NULL,
 %s::double precision,%s::double precision,
 CASE WHEN %s::double precision IS NULL THEN NULL
      ELSE ST_SetSRID(ST_MakePoint(%s::double precision,%s::double precision),4326)::geography END,
 'GeoNames','%s','CC BY 4.0',now())
ON CONFLICT (source_name,source_ref)
WHERE source_name IS NOT NULL AND source_ref IS NOT NULL
DO UPDATE SET
 parent_id=COALESCE(EXCLUDED.parent_id,marketplace_locations.parent_id),
 country_code=EXCLUDED.country_code,
 location_type=EXCLUDED.location_type,
 name=EXCLUDED.name,
 normalized_name=EXCLUDED.normalized_name,
 aliases=EXCLUDED.aliases,
 latitude=COALESCE(EXCLUDED.latitude,marketplace_locations.latitude),
 longitude=COALESCE(EXCLUDED.longitude,marketplace_locations.longitude),
 geom=COALESCE(EXCLUDED.geom,marketplace_locations.geom),
 source_license=EXCLUDED.source_license,
 source_updated_at=now(),
 is_active=true
"""

def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", value.casefold()).strip()

def stable_id(geoname_id: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"geonames:{geoname_id}")

def normalize_database_url(raw: str) -> str:
    value = (raw or "").strip().lstrip("\\").strip()
    value = re.sub(r"^(?:export\s+)?(?:NEON_DATABASE_URL|DATABASE_URL)\s*=\s*", "", value)
    value = value.strip().strip("'").strip('"').strip()
    match = re.search(r"(postgres(?:ql)?://[^\s'\"]+)", value)
    if match:
        value = match.group(1)
    if value.startswith(("postgres://", "postgresql://")):
        parsed = urlsplit(value)
        if not parsed.hostname or not parsed.path:
            raise SystemExit("NEON_DATABASE_URL is not a complete PostgreSQL URL (host/database missing).")
        user = quote(unquote(parsed.username or ""), safe="")
        password = quote(unquote(parsed.password or ""), safe="")
        auth = user + (":" + password if parsed.password is not None else "")
        netloc = (auth + "@" if auth else "") + parsed.hostname
        if parsed.port:
            netloc += ":" + str(parsed.port)
        return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))
    return value

def download(url: str, filename: str) -> Path:
    path = DATA_DIR / filename
    if path.exists() and path.stat().st_size:
        return path
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "DigiNanba-Global-Location-Importer/1.0"})
    print(f"Downloading {url}", flush=True)
    with urllib.request.urlopen(request, timeout=240) as response, path.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    return path

def row(country, kind, name, aliases, geoname_id, parent=None, lat=None, lon=None):
    name = (name or "").strip()
    if not name:
        return None
    aliases = list(dict.fromkeys(
        a.strip() for a in aliases if a and a.strip() and a.strip() != name
    ))[:20]
    ref = f"geoname:{geoname_id}"
    return (
        stable_id(str(geoname_id)), parent, country, kind, name, normalize(name), aliases,
        lat, lon, lat, lon, lat, ref,
    )

def flush(conn, rows, label, total):
    if not rows:
        return total
    with conn.cursor() as cur:
        cur.executemany(INSERT_SQL, rows)
    conn.commit()
    total += len(rows)
    print(f"{label}: upserted {total:,}", flush=True)
    rows.clear()
    return total

def main():
    database_url = normalize_database_url(os.environ.get("NEON_DATABASE_URL", ""))
    if not database_url:
        raise SystemExit("NEON_DATABASE_URL is required.")
    # Validate the secret before downloading the worldwide gazetteer.
    try:
        with psycopg.connect(database_url, connect_timeout=15) as check_conn:
            with check_conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
    except Exception as exc:
        raise SystemExit("NEON_DATABASE_URL could not connect to Neon. Check that the GitHub secret contains the full PostgreSQL connection URI without surrounding shell text.") from exc

    countries_file = download("https://download.geonames.org/export/dump/countryInfo.txt", "countryInfo.txt")
    admin1_file = download("https://download.geonames.org/export/dump/admin1CodesASCII.txt", "admin1CodesASCII.txt")
    admin2_file = download("https://download.geonames.org/export/dump/admin2Codes.txt", "admin2Codes.txt")
    all_file = download("https://download.geonames.org/export/dump/allCountries.zip", "allCountries.zip")

    country_ids = {}
    country_names = {}
    country_geoname_ids = {}
    with countries_file.open(encoding="utf-8") as source:
        for line in source:
            if not line.strip() or line.startswith("#"):
                continue
            f = line.rstrip("\n").split("\t")
            if len(f) < 17 or len(f[0]) != 2:
                continue
            code, name, geoname_id = f[0].upper(), f[4], f[16]
            country_ids[code] = stable_id(geoname_id)
            country_names[code] = name
            country_geoname_ids[code] = geoname_id

    admin1_ids = {}
    admin2_ids = {}
    with psycopg.connect(database_url, autocommit=False) as conn:
        rows = []
        for code, name in country_names.items():
            rows.append(row(code, "country", name, [], country_geoname_ids[code]))
        flush(conn, rows, "Countries", 0)

        rows = []
        with admin1_file.open(encoding="utf-8") as source:
            for line in source:
                f = line.rstrip("\n").split("\t")
                if len(f) < 4:
                    continue
                code, name, ascii_name, geoname_id = f[:4]
                parts = code.split(".", 1)
                country = parts[0].upper()
                if country not in country_ids:
                    continue
                admin1_ids[code] = stable_id(geoname_id)
                item = row(country, "state", ascii_name or name, [name], geoname_id, country_ids[country])
                if item:
                    rows.append(item)
                if len(rows) >= BATCH_SIZE:
                    flush(conn, rows, "Admin-1 divisions", len(admin1_ids) - len(rows))
        flush(conn, rows, "Admin-1 divisions", len(admin1_ids))

        rows = []
        with admin2_file.open(encoding="utf-8") as source:
            for line in source:
                f = line.rstrip("\n").split("\t")
                if len(f) < 4:
                    continue
                code, name, ascii_name, geoname_id = f[:4]
                parts = code.split(".")
                country = parts[0].upper()
                if country not in country_ids:
                    continue
                parent = admin1_ids.get(".".join(parts[:2]))
                admin2_ids[code] = stable_id(geoname_id)
                item = row(country, "district", ascii_name or name, [name], geoname_id, parent)
                if item:
                    rows.append(item)
                if len(rows) >= BATCH_SIZE:
                    flush(conn, rows, "Admin-2 divisions", len(admin2_ids) - len(rows))
        flush(conn, rows, "Admin-2 divisions", len(admin2_ids))

        total = 0
        rows = []
        with zipfile.ZipFile(all_file) as archive:
            member = next(name for name in archive.namelist() if name.endswith("allCountries.txt"))
            with archive.open(member) as raw:
                for raw_line in raw:
                    f = raw_line.decode("utf-8", errors="replace").rstrip("\n").split("\t")
                    if len(f) < 19 or f[6] != "P":
                        continue
                    geoname_id, name, ascii_name, alternate_names = f[:4]
                    feature_code = f[7]
                    country = f[8].upper()
                    if country not in country_ids:
                        continue
                    if feature_code in {"PPLH", "PPLW", "PPLQ"}:
                        continue
                    admin1 = f"{country}.{f[10]}" if f[10] else ""
                    admin2 = f"{admin1}.{f[11]}" if f[11] else ""
                    parent = admin2_ids.get(admin2) or admin1_ids.get(admin1) or country_ids[country]
                    try:
                        lat, lon = float(f[4]), float(f[5])
                    except (ValueError, TypeError):
                        lat = lon = None
                    try:
                        population = int(f[14] or 0)
                    except ValueError:
                        population = 0
                    if feature_code == "PPLX":
                        kind = "locality"
                    elif feature_code == "PPLF":
                        kind = "village"
                    elif feature_code.startswith("PPLA") or feature_code in {"PPLC", "PPLG"}:
                        kind = "city"
                    elif population and population < 5000:
                        kind = "village"
                    elif population and population < 100000:
                        kind = "town"
                    else:
                        kind = "city"
                    aliases = (alternate_names or "").split(",")[:20]
                    item = row(country, kind, ascii_name or name, aliases, geoname_id, parent, lat, lon)
                    if item:
                        rows.append(item)
                    if len(rows) >= BATCH_SIZE:
                        total = flush(conn, rows, "Global populated places", total)
        total = flush(conn, rows, "Global populated places", total)

    print("Worldwide GeoNames import complete. Existing OSM neighbourhood and street data remains intact.", flush=True)

if __name__ == "__main__":
    main()
