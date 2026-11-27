# DigiNanba India locality import (OpenStreetMap)

## Purpose

This is a separate staging import for named neighbourhoods, suburbs, localities,
settlements and streets. It does **not** activate OSM data in customer-facing
search and does not change official LGD records or shop addresses.

OpenStreetMap data is licensed under ODbL 1.0. Preserve attribution and review
share-alike obligations before publishing a database derived from it.

## Source

Geofabrik's free India extract is updated daily:

https://download.geofabrik.de/asia/india/index.html

The India PBF is large (about 1.6 GB at the time this pipeline was designed).
Allow substantial free disk space and memory. If the machine cannot process the
full extract, process Geofabrik's six regional extracts one at a time; the
source_ref upsert makes repeated/overlapping features safe.

## Extract only locality and named-road objects

Install Osmium Tool: https://osmcode.org/osmium-tool/

Download `india-latest.osm.pbf`, then run:

```bash
osmium tags-filter india-latest.osm.pbf nwr/place nwr/highway -o india-locality-source.osm.pbf
osmium export india-locality-source.osm.pbf -f geojsonseq -a type,id -o india-localities.geojsonseq
```

The GeoJSON Text Sequence keeps memory use in the importer bounded. The importer
retains named `place` features (city/town/village/hamlet/neighbourhood/suburb/
quarter/locality) and named highway features, and extracts alternate and
language-specific names into aliases. It stores the original OSM tags for later
review.

## Import to Neon staging

Apply `db/migrations/20261127_osm_locality_import_staging.sql` first. Then set
`NEON_DATABASE_URL` and run:

```bash
node scripts/import_osm_locality_geojsonseq.mjs india-localities.geojsonseq 2026-11-27
```

The importer is restartable/upsert-safe by OSM object identity (`node/ID`,
`way/ID`, `relation/ID`). It writes only to
`marketplace_locality_import_stage`, never to `marketplace_locations` or
`marketplace_location_search`.

## Reconciliation before activation

1. Import the complete LGD state/district/subdistrict/village directory.
2. Match OSM locality records to LGD administrative units using spatial
   containment (Survey of India boundaries where available) and name hints.
3. Keep unmatched or ambiguous records in staging for review; do not guess
   parent districts/taluks from names alone.
4. Compare against the existing inactive India GeoNames/OSM records.
5. Only after validation, promote selected records to the canonical location
   tables and refresh the search projection.
6. Keep OSM attribution and ODbL obligations visible in the data provenance.

The point stored for a line or polygon is an approximate representative point
for autocomplete/map pins only. It is not a legal boundary centroid or a
replacement for Survey of India boundary geometry.
