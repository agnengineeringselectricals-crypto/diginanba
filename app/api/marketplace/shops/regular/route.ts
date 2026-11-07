import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in to save a regular shop.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const publicId = typeof body?.publicId === 'string' ? body.publicId.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(publicId)) {
    return NextResponse.json({ error: 'Enter a valid DigiNanba shop ID.' }, { status: 400 });
  }
  try {
    const result = await db.query(
      `INSERT INTO marketplace_regular_shops(user_id,business_id)
       SELECT $1,id FROM marketplace_businesses WHERE public_id=$2 AND business_type='shop' AND listing_status='published'
       ON CONFLICT DO NOTHING RETURNING business_id`,
      [userId, publicId]
    );
    if (!result.rowCount) {
      const exists = await db.query(`SELECT 1 FROM marketplace_businesses WHERE public_id=$1 AND business_type='shop' AND listing_status='published'`, [publicId]);
      if (!exists.rowCount) return NextResponse.json({ error: 'Shop not found.' }, { status: 404 });
    }
    return NextResponse.json({ saved: true, message: 'Shop added to My Regular Shops.' });
  } catch (error) {
    console.error('Save regular shop failed', error);
    return NextResponse.json({ error: 'Could not save this shop.' }, { status: 503 });
  }
}
