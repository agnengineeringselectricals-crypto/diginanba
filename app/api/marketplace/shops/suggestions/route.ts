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
      const normalized = q.toLocaleLowerCase('en-IN').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const aliases: Record<string, string> = {
        trichy: 'tiruchirappalli', tiruchy: 'tiruchirappalli', tiruchi: 'tiruchirappalli',
        madras: 'chennai', bangalore: 'bengaluru', bombay: 'mumbai', calcutta: 'kolkata',
      };
      const canonicalQuery = aliases[normalized] || normalized;
      const cityMatches = INDIAN_CITIES
        .filter((item) => item.value.toLocaleLowerCase('en-IN').includes(canonicalQuery)
          || item.value.toLocaleLowerCase('en-IN').startsWith(canonicalQuery))
        .slice(0, 8)
        .map((item) => ({
          value: item.value,
          kind: item.value === 'Tiruchirappalli' && ['trichy','tiruchy','tiruchi'].includes(normalized)
            ? 'City / town · Trichy' : 'City / town',
          city: item.value,
          district: null,
          region: item.region,
        }));
      const result = await db.query(
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
             AND (value ILIKE '%' || $1 || '%'
               OR (lower($1) IN ('trichy','tiruchy','tiruchi')
                   AND lower(COALESCE(city,'')) LIKE '%tiruchirappalli%'))
         ) matches
         ORDER BY CASE WHEN value ILIKE $1 || '%' THEN 0 ELSE 1 END, value
         LIMIT 12`,
        [q]
      );
      const merged = new Map<string, (typeof cityMatches)[number] | (typeof result.rows)[number]>();
      for (const item of cityMatches) merged.set(item.value.toLocaleLowerCase('en-IN'), item);
      for (const item of result.rows) {
        const key = String(item.value || '').toLocaleLowerCase('en-IN');
        if (key && !merged.has(key)) merged.set(key, item);
      }
      return NextResponse.json({
        suggestions: Array.from(merged.values()).slice(0, 12),
      });
    }
    return NextResponse.json({ error: 'Unknown suggestion type.' }, { status: 400 });
  } catch (error) {
    console.error('Shop discovery suggestions failed', error);
    return NextResponse.json({ error: 'Suggestions are temporarily unavailable.', suggestions: [] }, { status: 503 });
  }
}
