import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// Built-in Indian city directory keeps city discovery independent of registered shops.
// Extend this with a maintained global geodata source as marketplace coverage expands.
const INDIAN_CITIES: Array<{ value: string; region: string }> = [
  { value: 'Chennai', region: 'Tamil Nadu' },
  { value: 'Salem', region: 'Tamil Nadu' },
  { value: 'Coimbatore', region: 'Tamil Nadu' },
  { value: 'Madurai', region: 'Tamil Nadu' },
  { value: 'Tiruchirappalli', region: 'Tamil Nadu' },
  { value: 'Tirunelveli', region: 'Tamil Nadu' },
  { value: 'Thoothukudi', region: 'Tamil Nadu' },
  { value: 'Erode', region: 'Tamil Nadu' },
  { value: 'Tiruppur', region: 'Tamil Nadu' },
  { value: 'Vellore', region: 'Tamil Nadu' },
  { value: 'Thanjavur', region: 'Tamil Nadu' },
  { value: 'Dindigul', region: 'Tamil Nadu' },
  { value: 'Karur', region: 'Tamil Nadu' },
  { value: 'Nagercoil', region: 'Tamil Nadu' },
  { value: 'Hosur', region: 'Tamil Nadu' },
  { value: 'Kanchipuram', region: 'Tamil Nadu' },
  { value: 'Cuddalore', region: 'Tamil Nadu' },
  { value: 'Kumbakonam', region: 'Tamil Nadu' },
  { value: 'Rajapalayam', region: 'Tamil Nadu' },
  { value: 'Sivakasi', region: 'Tamil Nadu' },
  { value: 'Bengaluru', region: 'Karnataka' },
  { value: 'Mysuru', region: 'Karnataka' },
  { value: 'Mangaluru', region: 'Karnataka' },
  { value: 'Hubballi', region: 'Karnataka' },
  { value: 'Mumbai', region: 'Maharashtra' },
  { value: 'Pune', region: 'Maharashtra' },
  { value: 'Nagpur', region: 'Maharashtra' },
  { value: 'Nashik', region: 'Maharashtra' },
  { value: 'New Delhi', region: 'Delhi' },
  { value: 'Hyderabad', region: 'Telangana' },
  { value: 'Warangal', region: 'Telangana' },
  { value: 'Kochi', region: 'Kerala' },
  { value: 'Thiruvananthapuram', region: 'Kerala' },
  { value: 'Kozhikode', region: 'Kerala' },
  { value: 'Thrissur', region: 'Kerala' },
  { value: 'Vijayawada', region: 'Andhra Pradesh' },
  { value: 'Visakhapatnam', region: 'Andhra Pradesh' },
  { value: 'Guntur', region: 'Andhra Pradesh' },
  { value: 'Kolkata', region: 'West Bengal' },
  { value: 'Howrah', region: 'West Bengal' },
  { value: 'Ahmedabad', region: 'Gujarat' },
  { value: 'Surat', region: 'Gujarat' },
  { value: 'Vadodara', region: 'Gujarat' },
  { value: 'Jaipur', region: 'Rajasthan' },
  { value: 'Jodhpur', region: 'Rajasthan' },
  { value: 'Udaipur', region: 'Rajasthan' },
  { value: 'Lucknow', region: 'Uttar Pradesh' },
  { value: 'Kanpur', region: 'Uttar Pradesh' },
  { value: 'Varanasi', region: 'Uttar Pradesh' },
  { value: 'Agra', region: 'Uttar Pradesh' },
  { value: 'Noida', region: 'Uttar Pradesh' },
  { value: 'Gurugram', region: 'Haryana' },
  { value: 'Chandigarh', region: 'Chandigarh' },
  { value: 'Bhopal', region: 'Madhya Pradesh' },
  { value: 'Indore', region: 'Madhya Pradesh' },
  { value: 'Patna', region: 'Bihar' },
  { value: 'Ranchi', region: 'Jharkhand' },
  { value: 'Bhubaneswar', region: 'Odisha' },
  { value: 'Guwahati', region: 'Assam' },
  { value: 'Raipur', region: 'Chhattisgarh' },
  { value: 'Dehradun', region: 'Uttarakhand' },
  { value: 'Shimla', region: 'Himachal Pradesh' },
  { value: 'Srinagar', region: 'Jammu and Kashmir' },
];


export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const requestedCountry = (url.searchParams.get('country') || 'IN').trim().toUpperCase();
  const countryCode = /^[A-Z]{2}$/.test(requestedCountry) ? requestedCountry : 'IN';
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  try {
    if (type === 'shops') {
      const result = await db.query(
        `SELECT business_name, public_id, city, district, region
         FROM marketplace_businesses
         WHERE business_type='shop' AND listing_status='published'
           AND (business_name ILIKE '%' || $1 || '%'
             OR upper(COALESCE(public_id,'')) LIKE '%' || upper($1) || '%')
         ORDER BY CASE WHEN business_name ILIKE $1 || '%' THEN 0 ELSE 1 END,
                  business_name
         LIMIT 10`,
        [q]
      );
      return NextResponse.json({ suggestions: result.rows });
    }
    if (type === 'products') {
      const result = await db.query(
        `SELECT l.title, l.category
         FROM marketplace_listings l
         JOIN marketplace_businesses b ON b.id = l.business_id
         WHERE l.listing_status = 'published'
           AND b.listing_status = 'published'
           AND b.business_type = 'shop'
           AND (l.title ILIKE '%' || $1 || '%' OR l.category ILIKE '%' || $1 || '%')
         GROUP BY l.title, l.category
         ORDER BY CASE WHEN l.title ILIKE $1 || '%' THEN 0 ELSE 1 END, l.title
         LIMIT 10`,
        [q]
      );
      return NextResponse.json({ suggestions: result.rows });
    }
    if (type === 'locations') {
      const normalized = q.toLocaleLowerCase('en-IN').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const commaParts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
      // Accept both "area, town" and natural typing such as "area town".
      // When there is no comma, use the final word as parent-place context
      // and search the preceding words as the locality name.
      const words = normalized.split(/\s+/).filter(Boolean);
      const nameQuery = commaParts.length > 1
        ? commaParts[0]
        : words.length >= 3 ? words.slice(0, -1).join(' ') : normalized;
      const contextQuery = commaParts.length > 1
        ? commaParts.slice(1).join(' ')
        : words.length >= 3 ? words[words.length - 1] : '';
      const aliases: Record<string, string> = {
        trichy: 'tiruchirappalli', tiruchy: 'tiruchirappalli', tiruchi: 'tiruchirappalli',
        madras: 'chennai', bangalore: 'bengaluru', bombay: 'mumbai', calcutta: 'kolkata',
      };
      const canonicalQuery = aliases[nameQuery] || nameQuery;
      const cityMatches = (countryCode === 'IN' ? INDIAN_CITIES : [])
        .filter((item) => item.value.toLocaleLowerCase('en-IN').includes(canonicalQuery)
          || item.value.toLocaleLowerCase('en-IN').startsWith(canonicalQuery))
        .slice(0, 8)
        .map((item) => ({
          value: item.value,
          kind: item.value === 'Tiruchirappalli' && ['trichy','tiruchy','tiruchi'].includes(normalized)
            ? 'City · Trichy' : 'City',
          city: item.value,
          district: null,
          region: item.region,
        }));
      const [shopLocationResult, geographicResult, tamilNaduTestResult] = await Promise.all([
        db.query(
          `WITH location_values AS (
             SELECT city AS value, 'City / town' AS kind, city, district, region FROM marketplace_businesses WHERE business_type='shop' AND listing_status='published'
             UNION ALL
             SELECT locality, 'Local area / village', city, district, region FROM marketplace_businesses WHERE business_type='shop' AND listing_status='published'
             UNION ALL
             SELECT district, 'District', city, district, region FROM marketplace_businesses WHERE business_type='shop' AND listing_status='published'
             UNION ALL
             SELECT address_line, 'Street / address', city, district, region FROM marketplace_businesses WHERE business_type='shop' AND listing_status='published'
             UNION ALL
             SELECT postal_code, 'Postal code', city, district, region FROM marketplace_businesses WHERE business_type='shop' AND listing_status='published'
           )
           SELECT value, kind, city, district, region
           FROM (
             SELECT DISTINCT
               CASE WHEN lower($1) IN ('trichy','tiruchy','tiruchi')
                         AND lower(COALESCE(city,'')) LIKE '%tiruchirappalli%'
                    THEN 'Tiruchirappalli' ELSE value END AS value,
               CASE WHEN lower($1) IN ('trichy','tiruchy','tiruchi')
                         AND lower(COALESCE(city,'')) LIKE '%tiruchirappalli%'
                    THEN 'City / town · Trichy' ELSE kind END AS kind,
               city, district, region
             FROM location_values
             WHERE COALESCE(value,'') <> ''
               AND ((kind = 'Street / address' AND value ILIKE $1 || '%')
                 OR (kind <> 'Street / address' AND value ILIKE '%' || $1 || '%')
                 OR (lower($1) IN ('trichy','tiruchy','tiruchi')
                     AND lower(COALESCE(city,'')) LIKE '%tiruchirappalli%'))
           ) matches
           ORDER BY CASE WHEN value ILIKE $1 || '%' THEN 0 ELSE 1 END, value
           LIMIT 12`,
          [q]
        ),
        db.query(
          `WITH matched AS (
             SELECT location_id AS id, name, location_type, normalized_name,
                    normalized_aliases AS aliases, postal_code, latitude, longitude,
                    city, town, village, district, state, country,
                    country_code,
                    CASE WHEN country_code = $2 THEN 0 ELSE 1 END AS country_rank,
                    CASE WHEN normalized_name = $1 THEN 0
                         WHEN normalized_name LIKE $1 || '%' THEN 1
                         WHEN $1 = ANY(normalized_aliases) THEN 2
                         WHEN EXISTS (
                           SELECT 1 FROM unnest(normalized_aliases) a
                           WHERE a LIKE '%' || $1 || '%'
                         ) THEN 3
                         ELSE 4 END AS rank_order
             FROM marketplace_location_search
             WHERE country_code = $2
               AND location_type NOT IN ('road', 'street')
               AND NOT (
                 location_type = 'district'
                 AND EXISTS (
                   SELECT 1 FROM marketplace_location_search preferred_place
                   WHERE preferred_place.country_code = $2
                     AND preferred_place.normalized_name = marketplace_location_search.normalized_name
                     AND preferred_place.location_type IN ('city', 'town')
                 )
               )
               AND NOT (
                 location_type = 'city'
                 AND EXISTS (
                   SELECT 1 FROM marketplace_location_search preferred_town
                   WHERE preferred_town.country_code = $2
                     AND preferred_town.normalized_name = marketplace_location_search.normalized_name
                     AND preferred_town.location_type = 'town'
                     AND (preferred_town.district IS NOT NULL OR preferred_town.state IS NOT NULL)
                 )
               )
               AND (
                 normalized_name = $1
                 OR normalized_name LIKE $1 || '%'
                 OR normalized_aliases @> ARRAY[$1]::text[]
                 OR (
                   char_length($1) >= 6
                   AND normalized_name % $1
                   AND similarity(normalized_name, $1) >= 0.68
                   AND NOT EXISTS (
                     SELECT 1
                     FROM marketplace_location_search exact_match
                     WHERE exact_match.country_code = $2
                       AND exact_match.location_type NOT IN ('road', 'street')
                       AND (
                         exact_match.normalized_name = $1
                         OR exact_match.normalized_name LIKE $1 || '%'
                         OR exact_match.normalized_aliases @> ARRAY[$1]::text[]
                       )
                   )
                 )
               )
               AND NOT EXISTS (
                 SELECT 1
                 FROM marketplace_location_search preferred
                 WHERE preferred.country_code = $2
                   AND preferred.normalized_name = marketplace_location_search.normalized_name
                   AND COALESCE(preferred.district, '') = COALESCE(marketplace_location_search.district, '')
                   AND COALESCE(preferred.state, '') = COALESCE(marketplace_location_search.state, '')
                   AND COALESCE(preferred.country, '') = COALESCE(marketplace_location_search.country, '')
                   AND preferred.location_id <> marketplace_location_search.location_id
                   AND (
                     (
                       (preferred.district IS NOT NULL OR preferred.state IS NOT NULL OR preferred.country IS NOT NULL)
                       AND (marketplace_location_search.district IS NULL AND marketplace_location_search.state IS NULL AND marketplace_location_search.country IS NULL)
                     )
                     OR CASE preferred.location_type
                          WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'village' THEN 2
                          WHEN 'hamlet' THEN 3 WHEN 'locality' THEN 4 WHEN 'suburb' THEN 5 ELSE 9
                        END
                        <
                        CASE marketplace_location_search.location_type
                          WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'village' THEN 2
                          WHEN 'hamlet' THEN 3 WHEN 'locality' THEN 4 WHEN 'suburb' THEN 5 ELSE 9
                        END
                   )
               )
             ORDER BY country_rank, rank_order,
                      similarity(normalized_name, $1) DESC,
                      name
             LIMIT 80
           )
           SELECT m.id AS location_id, m.name AS value, m.country_code,
                  CASE m.location_type
                    WHEN 'state' THEN 'State'
                    WHEN 'district' THEN 'District'
                    WHEN 'city' THEN 'City'
                    WHEN 'town' THEN 'Town'
                    WHEN 'village' THEN 'Village'
                    WHEN 'hamlet' THEN 'Hamlet'
                    WHEN 'locality' THEN 'Locality'
                    WHEN 'neighbourhood' THEN 'Neighbourhood'
                    WHEN 'suburb' THEN 'Suburb'
                    WHEN 'street' THEN 'Street'
                    WHEN 'road' THEN 'Road'
                    WHEN 'postal_code' THEN 'PIN code'
                    ELSE 'Place' END AS kind,
                  CASE WHEN lower(COALESCE(m.city, '')) = m.normalized_name THEN NULL ELSE m.city END AS city,
                  CASE WHEN lower(COALESCE(m.town, '')) = m.normalized_name THEN NULL ELSE m.town END AS town,
                  CASE WHEN lower(COALESCE(m.village, '')) = m.normalized_name THEN NULL ELSE m.village END AS village,
                  m.district, m.state,
                  m.state AS region, m.country, m.postal_code,
                  m.latitude, m.longitude,
                  CASE WHEN $3 <> '' AND NOT EXISTS (
                    SELECT 1 FROM regexp_split_to_table($3, '\\s+') AS context_token
                    WHERE context_token <> '' AND
                      lower(concat_ws(' ',m.city,m.town,m.village,m.district,m.state,m.country))
                      NOT LIKE '%' || lower(context_token) || '%'
                  ) THEN 0 ELSE 1 END AS context_rank
           FROM matched m
           ORDER BY m.country_rank, context_rank, m.rank_order,
                    CASE m.location_type
                      WHEN 'city' THEN 0 WHEN 'village' THEN 1 WHEN 'hamlet' THEN 2
                      WHEN 'locality' THEN 3 WHEN 'neighbourhood' THEN 4 WHEN 'suburb' THEN 5
                      WHEN 'town' THEN 6 WHEN 'street' THEN 7 WHEN 'road' THEN 8 ELSE 9 END,
                    m.city NULLS LAST, m.district NULLS LAST, m.name, m.id
           LIMIT 20`,

          [canonicalQuery, countryCode, contextQuery]
        )
      ]);
      // Temporary test-only source: surface the imported official Tamil Nadu
      // village hierarchy in the live autocomplete without modifying production
      // marketplace location tables. The label makes test-source results visible.
      const tamilNaduTestRows = countryCode === 'IN'
        ? (await db.query(
            `SELECT village_name AS value,
                    'Village · TN test' AS kind,
                    NULL::text AS city,
                    subdistrict_name AS town,
                    village_name AS village,
                    district_name AS district,
                    state_name AS state,
                    'India'::text AS country,
                    'IN'::text AS country_code,
                    NULL::text AS region
             FROM location_test.tamilnadu_official_villages
             WHERE village_name_normalized = $1
                OR village_name_normalized LIKE $1 || '%'
             ORDER BY CASE WHEN village_name_normalized = $1 THEN 0 ELSE 1 END,
                      village_name
             LIMIT 12`,
            [canonicalQuery]
          )).rows
        : [];

      // Promote a matching Indian directory city using the richer geographic
      // row when available, so a long list of similarly named towns cannot hide it.
      const promotedCities = cityMatches.map((item) => {
        const matchingPlace = geographicResult.rows.find((place) =>
          String(place.value).toLocaleLowerCase('en-IN') === item.value.toLocaleLowerCase('en-IN')
        );
        // The built-in directory is the canonical city classification. A
        // same-name geographic Town row may provide the verified hierarchy,
        // but must not downgrade the city suggestion back to "Town".
        return matchingPlace ? { ...matchingPlace, kind: item.kind } : item;
      });
      const promotedGeographyRows = new Set(
        promotedCities.filter((item) => geographicResult.rows.includes(item))
      );
      const orderedGeography = [
        ...promotedCities,
        ...tamilNaduTestRows,
        ...geographicResult.rows.filter((item) => !promotedGeographyRows.has(item)),
      ];
      const result = { rows: [...orderedGeography, ...shopLocationResult.rows] };
      const merged = new Map<string, (typeof cityMatches)[number] | (typeof result.rows)[number]>();
      // Preserve distinct places that share a name. A locality's full ancestry
      // is part of its identity; name + type alone incorrectly collapsed every
      // "Sai Nagar" into a single suggestion.
      const locationKey = (item: Record<string, unknown>) => [
        item.value, item.state || item.region, item.district, item.country_code || countryCode,
      ].map((part) => String(part || '').trim().toLocaleLowerCase('en-IN')).join('|');
      for (const item of orderedGeography) {
        const key = locationKey(item as Record<string, unknown>);
        if (!merged.has(key)) merged.set(key, item);
      }
      for (const item of []) {
        const key = locationKey(item as Record<string, unknown>);
        if (!merged.has(key)) merged.set(key, item);
      }
      for (const item of shopLocationResult.rows) {
        const key = locationKey(item as Record<string, unknown>);
        if (!merged.has(key)) merged.set(key, item);
      }
      return NextResponse.json({
        suggestions: Array.from(merged.values()).slice(0, 20),
      });
    }
    return NextResponse.json({ error: 'Unknown suggestion type.' }, { status: 400 });
  } catch (error) {
    console.error('Shop discovery suggestions failed', error);
    return NextResponse.json({ error: 'Suggestions are temporarily unavailable.', suggestions: [] }, { status: 503 });
  }
}
