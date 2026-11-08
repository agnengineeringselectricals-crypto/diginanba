import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ shops: [] });
  try {
    const result = await db.query(
      `SELECT b.id,b.business_name,b.public_id,b.city,b.region,c.is_pinned,c.connected_at
       FROM marketplace_customer_workspace_connections c
       JOIN marketplace_customer_accounts a ON a.id=c.workspace_account_id
       JOIN marketplace_businesses b ON b.id=a.workspace_ref
       WHERE c.customer_user_id=$1 AND c.status='connected' AND a.status='active'
       ORDER BY c.is_pinned DESC,c.connected_at DESC LIMIT 20`,
      [userId],
    );
    return NextResponse.json({ shops: result.rows });
  } catch (error) {
    console.error('Load customer shop connections failed', error);
    return NextResponse.json({ error: 'Could not load connected shops.' }, { status: 503 });
  }
}
