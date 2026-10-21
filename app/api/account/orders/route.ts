import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to view your orders.' }, { status: 401 });

  try {
    const result = await db.query(
      `SELECT o.id, o.created_at AS "createdAt", o.currency_code AS currency,
              o.total_minor::int AS "totalMinor", o.status,
              COUNT(oi.id)::int AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [session.user.id],
    );
    const orders = result.rows.map((row: any) => ({
      id: row.id,
      date: new Date(row.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      items: Number(row.items),
      total: new Intl.NumberFormat(row.currency === 'GBP' ? 'en-GB' : 'en-US', {
        style: 'currency',
        currency: row.currency,
      }).format(Number(row.totalMinor) / 100),
      status: row.status,
      canRequestRefund: row.status === 'paid',
    }));
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: 'Order history is temporarily unavailable.' }, { status: 503 });
  }
}
