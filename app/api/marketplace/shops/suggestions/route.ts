import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';


// Expand common English spellings of Tamil names into a small set of
// phonetic variants. This is deliberately conservative: fuzzy candidates are
// still ranked and thresholded in PostgreSQL, never blindly substituted.
function romanizedLocationVariants(value: string): string[] {
  const variants = new Set<string>([value]);
  // Handle common Tamil romanisation where two adjacent vowel sounds are
  // represented differently by non-local users (e.g. tiruvarembur ->
  // tiruverumbur). Apply both substitutions in one pass so a newly-created
  // "e" is not accidentally transformed a second time.
  const shiftedVowels = value.replace(/[ae]/g, (letter) => letter === 'a' ? 'e' : 'u');
  if (shiftedVowels.length >= 3 && shiftedVowels !== value) variants.add(shiftedVowels);
  const rules: Array<[RegExp, string]> = [
    [/th(?=[aeiou])/g, 't'],
    [/zh/g, 'l'],
    [/zh/g, 'z'],
    [/aa/g, 'a'],
    [/ee/g, 'i'],
    [/oo/g, 'u'],
    [/ou/g, 'au'],
    [/w/g, 'v'],
    // Common vowel substitutions in phonetic spellings. Applying these
    // incrementally lets a partial query such as "tiruvare" also try
    // "tiruveru", without maintaining a place-by-place alias list.
    [/a/g, 'e'],
    [/e/g, 'u'],
    [/o/g, 'u'],
    [/u/g, 'o'],
  ];

  for (const [pattern, replacement] of rules) {
    for (const current of Array.from(variants)) {
      const candidate = current.replace(pattern, replacement);
      if (candidate.length >= 3) variants.add(candidate);
      if (variants.size >= 10) return Array.from(variants);
    }
  }
  return Array.from(variants);
}

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
  // Indian PIN-code lookup is intentionally restricted to Tamil Nadu while
  // the state-level staging rollout is being validated. Start suggestions at
  // five digits: India Post exposes exact six-digit lookup, so expand a
  // five-digit prefix into its ten possible final digits and merge the offices.
  if (type === 'locations' && countryCode === 'IN' && /^\d{5,6}$/.test(q)) {
    try {
      const candidatePins = q.length === 6 ? [q] : Array.from({ length: 10 }, (_, digit) => q + digit);
      const postalResults = await Promise.allSettled(candidatePins.map(async (pin) => {
        const postalResponse = await fetch(
          `https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`,
          { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } }
        );
        if (!postalResponse.ok) throw new Error(`Postal lookup returned HTTP ${postalResponse.status}`);
        return await postalResponse.json() as Array<{
          Status?: string;
          PostOffice?: Array<{
            Name?: string | null;
            District?: string | null;
            State?: string | null;
            Pincode?: string | null;
            Block?: string | null;
            BranchType?: string | null;
            DeliveryStatus?: string | null;
          }> | null;
        }>;
      }));
      const successfulResults = postalResults.filter(
        (result): result is PromiseFulfilledResult<Array<{
          Status?: string;
          PostOffice?: Array<{
            Name?: string | null;
            District?: string | null;
            State?: string | null;
            Pincode?: string | null;
            Block?: string | null;
            BranchType?: string | null;
            DeliveryStatus?: string | null;
          }> | null;
        }>> => result.status === 'fulfilled'
      );
      if (successfulResults.length === 0) throw new Error('All India Post prefix lookups failed');
      const allOffices = successfulResults.flatMap((result) => {
        const record = Array.isArray(result.value) ? result.value[0] : undefined;
        return record?.Status === 'Success' && Array.isArray(record.PostOffice) ? record.PostOffice : [];
      });
      // India Post is country-wide. Keep every matching post office for a
      // five- or six-digit query; a PIN may map to multiple offices/localities.
      const matchingOffices = allOffices.filter((office) =>
        (office.Pincode || '').startsWith(q)
      );
      const uniqueOffices = new Map<string, (typeof matchingOffices)[number]>();
      for (const office of matchingOffices) {
        const key = [
          office.Name, office.District, office.Block, office.Pincode,
        ].map((part) => (part || '').trim().toLocaleLowerCase('en-IN')).join('|');
        if (office.Name && !uniqueOffices.has(key)) uniqueOffices.set(key, office);
      }
      const suggestions = Array.from(uniqueOffices.values()).slice(0, 30).map((office) => ({
        value: office.Name || '',
        kind: office.BranchType ? `Locality · Post office · ${office.BranchType}` : 'Locality · Post office',
        city: office.Block || null,
        town: office.Block || null,
        village: null,
        district: office.District || null,
        state: office.State || null,
        region: office.State || null,
        country: 'India',
        country_code: 'IN',
        postal_code: office.Pincode || q,
        delivery_status: office.DeliveryStatus || null,
      }));
      return NextResponse.json({
        suggestions,
        postal_code: q.length === 6 ? q : undefined,
        postal_code_prefix: q.length === 5 ? q : undefined,
        country_code: 'IN',
      });
    } catch (postalError) {
      console.error('Tamil Nadu PIN-code lookup failed', postalError);
      return NextResponse.json({
        error: 'PIN-code lookup is temporarily unavailable. You can still search by locality or village name.',
        suggestions: [],
      }, { status: 503 });
    }
  }
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
      // A trailing 5- or 6-digit PIN is postal context, not part of the
      // locality name or district. This supports searches like
      // "Ariyamangalam 62001" and keeps the locality match intact.
      const hasPostalContext = words.length >= 2 && /^\d{5,6}$/.test(words[words.length - 1]);
      // Preserve the complete multi-word locality name. Only split parent
      // context when the user explicitly separates it with a comma, or when
      // a PIN code is appended to the locality query.
      let nameQuery = commaParts.length > 1
        ? commaParts[0]
        : hasPostalContext ? words.slice(0, -1).join(' ')
        : normalized;
      let contextQuery = commaParts.length > 1
        ? commaParts.slice(1).join(' ')
        : '';
      const postalContext = hasPostalContext ? words[words.length - 1] : '';

      // For natural typing without commas (for example, "Alathur Tiru"),
      // detect whether the final token is a prefix of a known parent place.
      // Only split it when it matches a real district/taluk in the directory;
      // otherwise preserve the complete multi-word locality name.
      if (!hasPostalContext && commaParts.length <= 1 && words.length >= 2) {
        const trailingToken = words[words.length - 1];
        try {
          const parentHint = await db.query(
            `SELECT 1
             FROM (
               SELECT district_name AS parent_name FROM location_test.tamilnadu_official_villages
               UNION
               SELECT subdistrict_name AS parent_name FROM location_test.tamilnadu_official_villages
               UNION
               SELECT district_name_en AS parent_name FROM location_test.india_lgd_districts
               UNION
               SELECT subdistrict_name_en AS parent_name FROM location_test.india_lgd_subdistricts
             ) parents
             WHERE lower(regexp_replace(COALESCE(parent_name,''),'[^a-zA-Z0-9]+',' ','g'))
                   LIKE lower($1) || '%'
             LIMIT 1`,
            [trailingToken]
          );
          if (parentHint.rows.length > 0) {
            nameQuery = words.slice(0, -1).join(' ');
            contextQuery = trailingToken;
          }
        } catch (parentLookupError) {
          // Parent-context inference is an enhancement; normal locality
          // search remains available if one optional directory is unavailable.
          console.warn('Location parent-context inference skipped', parentLookupError);
        }
      }
      // Common exonyms, historic names and regional nicknames. These map
      // search terms to canonical directory names without changing stored data.
      const aliases: Record<string, string> = {
        trichy: 'tiruchirappalli', tiruchy: 'tiruchirappalli', tiruchi: 'tiruchirappalli', tiruchirapalli: 'tiruchirappalli', tiruchirappally: 'tiruchirappalli',
        kovai: 'coimbatore', koyamuthur: 'coimbatore',
        nellai: 'tirunelveli', tanjore: 'thanjavur',
        tuticorin: 'thoothukudi', kayalpatnam: 'thoothukudi',
        pondicherry: 'puducherry', madras: 'chennai',
        bangalore: 'bengaluru', bombay: 'mumbai', calcutta: 'kolkata',
      };
      const canonicalQuery = aliases[nameQuery] || nameQuery;
      const compactQuery = canonicalQuery.replace(/[^a-z0-9]/g, '');
      const fuzzySearchTerms = Array.from(new Set([
        ...romanizedLocationVariants(canonicalQuery),
        ...romanizedLocationVariants(compactQuery),
      ])).slice(0, 16);
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
      const [shopLocationResult, geographicResult, tamilNaduTestResult, indiaLgdResult] = await Promise.all([
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
        countryCode === 'IN' ? Promise.resolve({ rows: [] }) : db.query(
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
        ),
        countryCode === 'IN'
          ? db.query(
              `WITH place_candidates AS (
                 SELECT village_name AS value, village_name_normalized AS normalized,
                        district_name AS district, subdistrict_name AS town,
                        village_name AS village, 'Village'::text AS kind,
                        NULL::text AS postal_code, NULL::text AS post_office_name,
                        ARRAY[]::text[] AS aliases
                 FROM location_test.tamilnadu_official_villages
                 UNION
                 SELECT DISTINCT subdistrict_name AS value,
                        lower(regexp_replace(subdistrict_name, '[^a-zA-Z0-9]+', ' ', 'g')) AS normalized,
                        district_name AS district, subdistrict_name AS town,
                        NULL::text AS village, 'Taluk / subdistrict'::text AS kind,
                        NULL::text AS postal_code, NULL::text AS post_office_name,
                        ARRAY[]::text[] AS aliases
                 FROM location_test.tamilnadu_official_villages
                 UNION ALL
                 SELECT locality_name AS value, normalized_name AS normalized,
                        district_name AS district, NULL::text AS town,
                        NULL::text AS village, locality_type AS kind,
                        pincode AS postal_code, post_office_name,
                        aliases
                 FROM location_test.tamilnadu_postal_localities
                 WHERE state_name = 'Tamil Nadu'
               ),
               scored AS (
                 SELECT p.*,
                        CASE
                          WHEN p.normalized = ANY($1::text[])
                            OR EXISTS (SELECT 1 FROM unnest(p.aliases) a WHERE a = ANY($1::text[])) THEN 0
                          WHEN EXISTS (
                            SELECT 1 FROM unnest($1::text[]) t
                            WHERE p.normalized LIKE t || '%'
                               OR EXISTS (SELECT 1 FROM unnest(p.aliases) a WHERE a LIKE t || '%')
                          ) THEN 1
                          ELSE 2
                        END AS match_rank,
                        GREATEST(
                          (SELECT MAX(GREATEST(similarity(p.normalized, term), word_similarity(term, p.normalized)))
                           FROM unnest($1::text[]) AS term),
                          COALESCE((
                            SELECT MAX(GREATEST(similarity(alias, term), word_similarity(term, alias)))
                            FROM unnest(p.aliases) AS alias
                            CROSS JOIN unnest($1::text[]) AS term
                          ), 0)
                        ) AS match_score,
                        CASE
                          WHEN $2 = '' THEN 0
                          WHEN lower(COALESCE(p.district,'')) LIKE '%' || lower($2) || '%'
                            OR lower(COALESCE(p.town,'')) LIKE '%' || lower($2) || '%' THEN 0
                          ELSE 1
                        END AS context_rank
                 FROM place_candidates p
                 WHERE (
                   (
                     EXISTS (
                       SELECT 1 FROM unnest($1::text[]) AS term
                       WHERE p.normalized = term
                          OR p.normalized LIKE term || '%'
                          OR similarity(p.normalized, term) >= 0.32
                          OR word_similarity(term, p.normalized) >= 0.50
                          OR EXISTS (
                            SELECT 1 FROM unnest(p.aliases) AS alias
                            WHERE alias = term
                               OR alias LIKE term || '%'
                               OR alias ILIKE '%' || term || '%'
                               OR similarity(alias, term) >= 0.32
                               OR word_similarity(term, alias) >= 0.50
                          )
                     )

                   )
                   OR (
                     $2 = ''
                     AND p.kind IN ('Village', 'Post Office', 'Postal locality')
                     AND EXISTS (
                       SELECT 1 FROM unnest($1::text[]) AS district_term
                       WHERE lower(COALESCE(p.district, '')) LIKE '%' || lower(district_term) || '%'
                     )
                   )
                 )
               )
               SELECT value, kind, NULL::text AS city, town, village, district,
                      'Tamil Nadu'::text AS state, 'India'::text AS country,
                      'IN'::text AS country_code, NULL::text AS region,
                      postal_code, post_office_name
               FROM scored
               WHERE match_rank < 2 OR match_score >= 0.50
               ORDER BY context_rank, match_rank, match_score DESC, value
               LIMIT 20`,
              [fuzzySearchTerms, postalContext || contextQuery]
            )
          : Promise.resolve({ rows: [] }),
        // National LGD village/subdistrict/district directory is enabled for
        // non-Tamil-Nadu states only. Tamil Nadu continues using its established
        // source until its separately reported code/name exceptions are resolved.
        countryCode === 'IN'
          ? db.query(
              `WITH candidates AS (
                 SELECT v.village_name AS value, 'Village'::text AS kind,
                        NULL::text AS city, v.subdistrict_name AS town,
                        v.village_name AS village, v.district_name AS district,
                        v.state_name AS state, v.state_name AS region,
                        'India'::text AS country, 'IN'::text AS country_code,
                        NULL::text AS postal_code, v.village_lgd_code AS source_id,
                        CASE WHEN v.village_name_normalized = ANY($1::text[]) THEN 0
                             WHEN EXISTS (SELECT 1 FROM unnest($1::text[]) t WHERE v.village_name_normalized LIKE t || '%') THEN 1
                             ELSE 2 END AS match_rank
                 FROM location_test.india_other_states_official_villages v
                 WHERE lower(v.state_name) <> 'tamil nadu'
                   AND (
                     v.village_name_normalized = ANY($1::text[])
                     OR EXISTS (SELECT 1 FROM unnest($1::text[]) t WHERE v.village_name_normalized LIKE t || '%')
                   )

                 UNION ALL
                 SELECT s.subdistrict_name_en, 'Taluk / subdistrict', NULL, s.subdistrict_name_en,
                        NULL, d.district_name_en, st.state_name_en, st.state_name_en,
                        'India', 'IN', NULL, s.subdistrict_lgd_code,
                        CASE WHEN lower(regexp_replace(s.subdistrict_name_en,'[^a-zA-Z0-9]+',' ','g')) = ANY($1::text[]) THEN 0
                             WHEN EXISTS (SELECT 1 FROM unnest($1::text[]) t WHERE lower(regexp_replace(s.subdistrict_name_en,'[^a-zA-Z0-9]+',' ','g')) LIKE t || '%') THEN 1
                             ELSE 2 END
                 FROM location_test.india_lgd_subdistricts s
                 JOIN location_test.india_lgd_districts d ON d.district_lgd_code=s.district_lgd_code
                 JOIN location_test.india_lgd_states st ON st.state_lgd_code=s.state_lgd_code
                 WHERE st.state_name_en <> 'Tamil Nadu'
                   AND (lower(regexp_replace(s.subdistrict_name_en,'[^a-zA-Z0-9]+',' ','g')) = ANY($1::text[])
                     OR EXISTS (SELECT 1 FROM unnest($1::text[]) t WHERE lower(regexp_replace(s.subdistrict_name_en,'[^a-zA-Z0-9]+',' ','g')) LIKE t || '%'))

                 UNION ALL
                 SELECT d.district_name_en, 'District', NULL, NULL, NULL,
                        d.district_name_en, st.state_name_en, st.state_name_en,
                        'India', 'IN', NULL, d.district_lgd_code,
                        CASE WHEN lower(regexp_replace(d.district_name_en,'[^a-zA-Z0-9]+',' ','g')) = ANY($1::text[]) THEN 0
                             WHEN EXISTS (SELECT 1 FROM unnest($1::text[]) t WHERE lower(regexp_replace(d.district_name_en,'[^a-zA-Z0-9]+',' ','g')) LIKE t || '%') THEN 1
                             ELSE 2 END
                 FROM location_test.india_lgd_districts d
                 JOIN location_test.india_lgd_states st ON st.state_lgd_code=d.state_lgd_code
                 WHERE st.state_name_en <> 'Tamil Nadu'
                   AND (lower(regexp_replace(d.district_name_en,'[^a-zA-Z0-9]+',' ','g')) = ANY($1::text[])
                     OR EXISTS (SELECT 1 FROM unnest($1::text[]) t WHERE lower(regexp_replace(d.district_name_en,'[^a-zA-Z0-9]+',' ','g')) LIKE t || '%'))
               )
               SELECT value, kind, city, town, village, district, state, region,
                      country, country_code, postal_code
               FROM candidates
               ORDER BY match_rank, value, district NULLS LAST
               LIMIT 30`,
              [fuzzySearchTerms]
            )
          : Promise.resolve({ rows: [] }),
      ]);
      // TN test data and national LGD data are fetched separately in parallel.
      const tamilNaduTestRows = tamilNaduTestResult.rows;
      const indiaLgdRows = indiaLgdResult.rows;

      // Run bounded typo-tolerant matching for every location query once it
      // is long enough to be meaningful. This runs alongside prefix matching,
      // because a partial prefix may return unrelated places and otherwise
      // prevent the intended typo-tolerant result from ever being considered.
      // pg_trgm similarity handles misspellings; word_similarity also handles
      // a correctly typed beginning of a longer place name.
      const fuzzyGeographyRows = countryCode !== 'IN' && canonicalQuery.length >= 5
        ? (await db.query(
            `WITH candidates AS (
               SELECT location_id, name, location_type, normalized_name,
                      normalized_aliases, city, town, village, district, state,
                      country, postal_code, latitude, longitude,
                      GREATEST(
                        (SELECT MAX(GREATEST(
                           similarity(normalized_name, term),
                           word_similarity(term, normalized_name)
                         )) FROM unnest($3::text[]) AS term),
                        COALESCE((
                          SELECT MAX(GREATEST(
                            similarity(alias, term),
                            word_similarity(term, alias)
                          ))
                          FROM unnest(normalized_aliases) AS alias
                          CROSS JOIN unnest($3::text[]) AS term
                        ), 0)
                      ) AS match_score
               FROM marketplace_location_search
               WHERE country_code = $2
                 AND location_type NOT IN ('road', 'street')
                 AND (
                   normalized_name % ANY($3::text[])
                   OR EXISTS (
                     SELECT 1 FROM unnest($3::text[]) AS term
                     WHERE term <% normalized_name
                   )
                   OR EXISTS (
                     SELECT 1
                     FROM unnest(normalized_aliases) AS alias
                     WHERE alias % ANY($3::text[])
                        OR EXISTS (
                          SELECT 1 FROM unnest($3::text[]) AS term
                          WHERE term <% alias
                        )
                   )
                 )
             ),
             ranked AS (
               SELECT *,
                      ROW_NUMBER() OVER (
                        PARTITION BY normalized_name, COALESCE(district, ''), COALESCE(state, ''), COALESCE(country, '')
                        ORDER BY
                          (district IS NOT NULL OR state IS NOT NULL OR country IS NOT NULL) DESC,
                          match_score DESC,
                          CASE location_type
                            WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'village' THEN 2
                            WHEN 'hamlet' THEN 3 WHEN 'locality' THEN 4 WHEN 'suburb' THEN 5 ELSE 9
                          END
                      ) AS duplicate_rank
               FROM candidates
               WHERE match_score >= 0.50
             )
             SELECT location_id AS location_id, name AS value, country_code,
                    CASE location_type
                      WHEN 'state' THEN 'State'
                      WHEN 'district' THEN 'District'
                      WHEN 'city' THEN 'City'
                      WHEN 'town' THEN 'Town'
                      WHEN 'village' THEN 'Village'
                      WHEN 'hamlet' THEN 'Hamlet'
                      WHEN 'locality' THEN 'Locality'
                      WHEN 'neighbourhood' THEN 'Neighbourhood'
                      WHEN 'suburb' THEN 'Suburb'
                      ELSE 'Place' END AS kind,
                    city, town, village, district, state, state AS region,
                    country, postal_code, latitude, longitude, 1 AS context_rank
             FROM ranked
             WHERE duplicate_rank = 1
             ORDER BY match_score DESC, name
             LIMIT 20`,
            [canonicalQuery, countryCode, fuzzySearchTerms]
          )).rows
        : [];
      // Keep exact matches first, then introduce fuzzy matches before the
      // potentially noisy tail of prefix results. Existing location identity
      // de-duplication below still preserves same-name places in different areas.
      const exactGeographyRows = geographicResult.rows.filter((place) =>
        String(place.value).toLocaleLowerCase('en-IN') === canonicalQuery
      );
      const fuzzyKeys = new Set(fuzzyGeographyRows.map((place) =>
        [place.value, place.state || place.region, place.district, place.country_code]
          .map((part) => String(part || '').trim().toLocaleLowerCase('en-IN')).join('|')
      ));
      const geographyRows = [
        ...exactGeographyRows,
        ...fuzzyGeographyRows,
        ...geographicResult.rows.filter((place) =>
          !exactGeographyRows.includes(place)
          && !fuzzyKeys.has([place.value, place.state || place.region, place.district, place.country_code]
            .map((part) => String(part || '').trim().toLocaleLowerCase('en-IN')).join('|'))
        ),
      ];
      // Promote a matching Indian directory city using the richer geographic
      // row when available, so a long list of similarly named towns cannot hide it.
      const promotedCities = cityMatches.map((item) => {
        const matchingPlace = geographyRows.find((place) =>
          String(place.value).toLocaleLowerCase('en-IN') === item.value.toLocaleLowerCase('en-IN')
        );
        // The built-in directory is the canonical city classification. A
        // same-name geographic Town row may provide the verified hierarchy,
        // but must not downgrade the city suggestion back to "Town".
        return matchingPlace ? { ...matchingPlace, kind: item.kind } : item;
      });
      const promotedGeographyRows = new Set(
        promotedCities.filter((item) => geographyRows.includes(item))
      );
      const orderedGeography = [
        ...promotedCities,
        ...tamilNaduTestRows,
        ...indiaLgdRows,
        ...geographyRows.filter((item) => !promotedGeographyRows.has(item)),
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
      for (const item of shopLocationResult.rows) {
        const key = locationKey(item as Record<string, unknown>);
        if (!merged.has(key)) merged.set(key, item);
      }
      // Rank the combined India-wide result set by locality-name relevance.
      // This prevents a fuzzy Tamil Nadu hit from appearing above a much
      // closer national LGD match, and prefers a village whose own subdistrict
      // has the same name when several states contain the same village name.
      const rankedSuggestions = Array.from(merged.values()).sort((a, b) => {
        const normalize = (value: unknown) => String(value || '')
          .toLocaleLowerCase('en-IN')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        const target = normalize(canonicalQuery);
        const score = (item: Record<string, unknown>) => {
          const value = normalize(item.value);
          if (value === target) return 0;
          if (value.startsWith(target)) return 1;
          // Bounded Levenshtein distance handles common one-character
          // omissions/insertions such as "goranta" -> "gorantla".
          const previous = Array.from({ length: value.length + 1 }, (_, i) => i);
          for (let i = 1; i <= target.length; i++) {
            let diagonal = previous[0];
            previous[0] = i;
            for (let j = 1; j <= value.length; j++) {
              const above = previous[j];
              previous[j] = Math.min(
                previous[j] + 1,
                previous[j - 1] + 1,
                diagonal + (target[i - 1] === value[j - 1] ? 0 : 1)
              );
              diagonal = above;
            }
          }
          const distance = previous[value.length];
          const ratio = distance / Math.max(target.length, value.length, 1);
          return ratio <= 0.35 ? 2 + ratio : 3 + ratio;
        };
        const left = score(a as Record<string, unknown>);
        const right = score(b as Record<string, unknown>);
        if (left !== right) return left - right;
        const leftParentMatch = normalize(a.town) === normalize(a.value) ? 0 : 1;
        const rightParentMatch = normalize(b.town) === normalize(b.value) ? 0 : 1;
        if (leftParentMatch !== rightParentMatch) return leftParentMatch - rightParentMatch;
        return String(a.value || '').localeCompare(String(b.value || ''), 'en-IN');
      });
      return NextResponse.json({
        suggestions: rankedSuggestions.slice(0, 20),
      });
    }
    return NextResponse.json({ error: 'Unknown suggestion type.' }, { status: 400 });
  } catch (error) {
    console.error('Shop discovery suggestions failed', error);
    return NextResponse.json({ error: 'Suggestions are temporarily unavailable.', suggestions: [] }, { status: 503 });
  }
}