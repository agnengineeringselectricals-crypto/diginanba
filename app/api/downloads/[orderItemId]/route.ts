import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPrivateDownloadUrl } from '@/lib/server/private-downloads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, context: { params: Promise<{ orderItemId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { orderItemId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderItemId)) {
    return NextResponse.json({ error: 'Download not found' }, { status: 404 });
  }
  try {
    const result = await db.query(
      `SELECT oi.id AS order_item_id, pa.storage_key
       FROM entitlements e
       JOIN order_items oi ON oi.id = e.order_item_id
       JOIN orders o ON o.id = oi.order_id
       JOIN product_assets pa ON pa.product_id = oi.product_id
        AND (pa.product_edition_id IS NULL OR pa.product_edition_id = oi.product_edition_id)
        AND pa.asset_kind = 'download' AND pa.scan_status = 'clean'
       WHERE e.user_id = $1 AND e.order_item_id = $2
         AND e.status = 'active' AND o.status = 'paid'
       ORDER BY (pa.product_edition_id IS NOT NULL) DESC, pa.created_at DESC LIMIT 1`,
      [session.user.id, orderItemId],
    );
    const asset = result.rows[0];
    if (!asset) return NextResponse.json({ error: 'No verified purchase or approved downloadable file is available for this item yet.' }, { status: 404 });
    const signedUrl = createPrivateDownloadUrl(String(asset.storage_key), 60);
    await db.query(
      `INSERT INTO downloads(order_item_id, asset_key, download_count, last_downloaded_at)
       VALUES($1, $2, 1, now())
       ON CONFLICT (order_item_id, asset_key)
       DO UPDATE SET download_count = downloads.download_count + 1, last_downloaded_at = now()`,
      [asset.order_item_id, asset.storage_key],
    );
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    if (error instanceof Error && error.message === 'Private download storage is not configured') {
      return NextResponse.json({ error: 'Secure file delivery is not configured yet. Please contact DigiNanba support.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unable to create a secure download link' }, { status: 500 });
  }
}
