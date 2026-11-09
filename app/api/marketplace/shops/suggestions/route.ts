import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  try {
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
         SELECT DISTINCT value, kind, city, district, region
         FROM location_values
         WHERE COALESCE(value,'') <> '' AND value ILIKE '%' || $1 || '%'
         ORDER BY CASE WHEN value ILIKE $1 || '%' THEN 0 ELSE 1 END, value
         LIMIT 12`,
        [q]
      );
      return NextResponse.json({ suggestions: result.rows });
    }
    return NextResponse.json({ error: 'Unknown suggestion type.' }, { status: 400 });
  } catch (error) {
    console.error('Shop discovery suggestions failed', error);
    return NextResponse.json({ error: 'Suggestions are temporarily unavailable.', suggestions: [] }, { status: 503 });
  }
}
