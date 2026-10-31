import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const continentByCountry: Record<string, string> = {
  IN:'Asia', JP:'Asia', CN:'Asia', SG:'Asia', AE:'Asia', SA:'Asia', GB:'Europe', DE:'Europe', FR:'Europe',
  IT:'Europe', ES:'Europe', NL:'Europe', SE:'Europe', US:'North America', CA:'North America', MX:'North America',
  BR:'South America', AR:'South America', ZA:'Africa', NG:'Africa', EG:'Africa', AU:'Oceania', NZ:'Oceania'
};
const validMarkets = new Set(['US', 'UK', 'IN']);

function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ').slice(0, 180);
}
function short(value: string | null, max = 120) {
  return (value ?? '').trim().slice(0, max) || null;
}
async function ensureGeo(country: string | null, region: string | null, city: string | null) {
  if (!country || !/^[A-Z]{2}$/.test(country)) return null;
  const continent = continentByCountry[country];
  let parentId: string | null = null;
  if (continent) {
    const continentRow = await db.query(
      `INSERT INTO geography_nodes(level,name,normalized_name)
       VALUES('continent',$1,$2) ON CONFLICT (parent_id,level,normalized_name)
       DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [continent, normalize(continent)]
    );
    parentId = continentRow.rows[0]?.id ?? null;
  }
  const countryName = country;
  const countryRow = await db.query(
    `INSERT INTO geography_nodes(parent_id,level,code,name,normalized_name,country_code)
     VALUES($1,'country',$2,$3,$4,$2)
     ON CONFLICT (parent_id,level,normalized_name)
     DO UPDATE SET code=EXCLUDED.code RETURNING id`,
    [parentId, country, countryName, normalize(countryName)]
  );
  parentId = countryRow.rows[0]?.id ?? null;
  const regionName = short(region, 100);
  if (regionName && parentId) {
    const stateRow = await db.query(
      `INSERT INTO geography_nodes(parent_id,level,code,name,normalized_name,country_code)
       VALUES($1,'state',$2,$3,$4,$5)
       ON CONFLICT (parent_id,level,normalized_name)
       DO UPDATE SET code=EXCLUDED.code RETURNING id`,
      [parentId, regionName, regionName, normalize(regionName), country]
    );
    parentId = stateRow.rows[0]?.id ?? parentId;
  }
  const cityName = short(city, 100);
  if (cityName && parentId) {
    const cityRow = await db.query(
      `INSERT INTO geography_nodes(parent_id,level,name,normalized_name,country_code)
       VALUES($1,'city',$2,$3,$4)
       ON CONFLICT (parent_id,level,normalized_name)
       DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [parentId, cityName, normalize(cityName), country]
    );
    parentId = cityRow.rows[0]?.id ?? parentId;
  }
  return parentId;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const queryText = typeof body?.query === 'string' ? body.query.trim().slice(0, 180) : '';
  const normalizedQuery = normalize(queryText);
  if (normalizedQuery.length < 2) return NextResponse.json({ products: [], logged: false });
  const marketInput = typeof body?.market === 'string' ? body.market.toUpperCase() : 'IN';
  const market = validMarkets.has(marketInput) ? marketInput : 'IN';
  const locale = short(typeof body?.locale === 'string' ? body.locale : req.headers.get('accept-language')?.split(',')[0], 20);
  const source = body?.source === 'explore' || body?.source === 'category' ? body.source : 'search_bar';
  const visitorId = short(typeof body?.visitorId === 'string' ? body.visitorId : null, 100);
  const visitorHash = visitorId ? createHash('sha256').update(visitorId).digest('hex') : null;
  const session = await auth().catch(() => null);
  const country = short(req.headers.get('x-vercel-ip-country')?.toUpperCase() ?? req.headers.get('cf-ipcountry')?.toUpperCase() ?? null, 2);
  const region = short(req.headers.get('x-vercel-ip-country-region') ?? req.headers.get('x-vercel-ip-region'), 100);
  const city = short(req.headers.get('x-vercel-ip-city'), 100);
  let geographyId: string | null = null;
  try {
    geographyId = await ensureGeo(country, region, city);
  } catch (error) {
    console.warn('Search geography enrichment skipped', error);
  }

  try {
    const result = await db.query(
      `SELECT p.id,p.public_id,p.slug,p.title,COALESCE(NULLIF(p.short_description,''),p.description,'') AS description,
              COALESCE(c.name,'Digital Products') AS category,pe.market_code,pr.currency_code,pr.amount_minor,
              COALESCE(cp.display_name,u.display_name,'DigiNanba') AS creator_name,
              COALESCE(u.public_id,'DN-C-000001') AS creator_id
       FROM products p
       JOIN product_editions pe ON pe.product_id=p.id AND pe.market_code=$1 AND pe.status='published'
       JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL
       LEFT JOIN categories c ON c.id=p.category_id
       LEFT JOIN users u ON u.id=p.creator_user_id
       LEFT JOIN creator_profiles cp ON cp.user_id=u.id
       WHERE p.status='published'
         AND (p.public_id ILIKE '%'||$2||'%' OR p.id::text ILIKE '%'||$2||'%' OR
              p.title ILIKE '%'||$2||'%' OR p.short_description ILIKE '%'||$2||'%' OR p.description ILIKE '%'||$2||'%' OR
              COALESCE(c.name,'') ILIKE '%'||$2||'%' OR COALESCE(cp.display_name,u.display_name,'DigiNanba') ILIKE '%'||$2||'%' OR
              COALESCE(u.public_id,'DN-C-000001') ILIKE '%'||$2||'%')
       ORDER BY CASE WHEN lower(p.public_id)=lower($2) OR lower(p.id::text)=lower($2) THEN 0
                     WHEN lower(p.title)=lower($2) THEN 1 WHEN p.title ILIKE $2||'%' THEN 2 ELSE 3 END, p.created_at DESC
       LIMIT 12`,
      [market, queryText]
    );
    const { rows } = result;
    const event = await db.query(
      `INSERT INTO product_search_events(user_id,visitor_key_hash,query_text,normalized_query,query_language,market_code,locale,geography_node_id,country_code,region_code,results_count,source)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [session?.user?.id ?? null, visitorHash, queryText, normalizedQuery, locale?.split('-')[0] ?? null, market, locale, geographyId, country, region, rows.length, source]
    );
    await db.query(
      `INSERT INTO product_demand_clusters(normalized_query,display_query,query_language,geography_node_id,country_code,market_code,event_count,zero_result_count,first_searched_at,last_searched_at,demand_score)
       VALUES($1,$2,$3,$4,$5,$6,1,$7,now(),now(),CASE WHEN $7=1 THEN 2 ELSE 0.25 END)
       ON CONFLICT (normalized_query,geography_node_id,market_code,query_language)
       DO UPDATE SET event_count=product_demand_clusters.event_count+1,
         zero_result_count=product_demand_clusters.zero_result_count+EXCLUDED.zero_result_count,
         last_searched_at=now(), display_query=CASE WHEN length(EXCLUDED.display_query)>length(product_demand_clusters.display_query) THEN EXCLUDED.display_query ELSE product_demand_clusters.display_query END,
         demand_score=product_demand_clusters.demand_score+CASE WHEN EXCLUDED.zero_result_count=1 THEN 2 ELSE 0.25 END, updated_at=now()`,
      [normalizedQuery, queryText, locale?.split('-')[0] ?? null, geographyId, country, market, rows.length === 0 ? 1 : 0]
    );
    const products = rows.map((row: any) => {
      const amountMinor = Number(row.amount_minor);
      const currency = market === 'IN' ? 'INR' : market === 'UK' ? 'GBP' : 'USD';
      const localeForCurrency = currency === 'INR' ? 'en-IN' : currency === 'GBP' ? 'en-GB' : 'en-US';
      return { id: row.id, publicId: row.public_id ?? row.id, slug: row.slug, title: row.title, description: row.description ?? '', category: row.category,
        creatorName: row.creator_name ?? 'DigiNanba', creatorId: row.creator_id ?? 'DN-C-000001', market: row.market_code, currency, amountMinor,
        price: new Intl.NumberFormat(localeForCurrency, { style: 'currency', currency }).format(amountMinor / 100) };
    });
    return NextResponse.json({ products, logged: true, eventId: event.rows[0]?.id, noResults: products.length === 0 });
  } catch (error) {
    console.error('Product search demand logging failed', error);
    return NextResponse.json({ products: [], logged: false, error: 'Search suggestions are temporarily unavailable.' }, { status: 503 });
  }
}
