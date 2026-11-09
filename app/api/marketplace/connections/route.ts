import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ shops: [] });
  try {
    // Saved regular shops are the customer's favourites in My Shops.
    // Include explicitly pinned workspace connections as well, without duplicates.
    const result = await db.query(
      `SELECT DISTINCT ON (id) id,public_id,business_name,city,locality,region,country_code,region_code,
              door_delivery_enabled,self_collection_enabled,true AS is_pinned
       FROM (
         SELECT b.id,b.public_id,b.business_name,b.city,b.locality,b.region,b.country_code,b.region_code,
                b.door_delivery_enabled,b.self_collection_enabled,s.created_at AS saved_at
         FROM marketplace_regular_shops s
         JOIN marketplace_businesses b ON b.id=s.business_id
         WHERE s.user_id=$1 AND b.business_type='shop' AND b.listing_status='published'
         UNION ALL
         SELECT b.id,b.public_id,b.business_name,b.city,b.locality,b.region,b.country_code,b.region_code,
                b.door_delivery_enabled,b.self_collection_enabled,c.connected_at AS saved_at
         FROM marketplace_customer_workspace_connections c
         JOIN marketplace_customer_accounts a ON a.id=c.workspace_account_id
         JOIN marketplace_businesses b ON b.id=a.workspace_ref
         WHERE c.customer_user_id=$1 AND c.status='connected' AND c.is_pinned=true
           AND a.status='active' AND b.business_type='shop' AND b.listing_status='published'
       ) saved
       ORDER BY id,saved_at DESC
       LIMIT 30`,
      [userId],
    );
    return NextResponse.json({ shops: result.rows });
  } catch (error) {
    console.error('Load customer favourite shops failed', error);
    return NextResponse.json({ error: 'Could not load favourite shops.' }, { status: 503 });
  }
}
