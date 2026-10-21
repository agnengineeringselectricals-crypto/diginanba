import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(5).max(2000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  let input: z.infer<typeof schema>;
  try { input = schema.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Provide a valid order ID and a reason of at least 5 characters.' }, { status: 400 }); }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query(
      `SELECT o.id, p.id AS payment_id
       FROM orders o
       JOIN payments p ON p.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2 AND o.status = 'paid'
         AND p.status = 'succeeded' AND p.provider_payment_id IS NOT NULL
       ORDER BY p.updated_at DESC
       LIMIT 1
       FOR UPDATE OF o, p`,
      [input.orderId, session.user.id],
    );
    if (!order.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Only verified paid orders can be submitted for refund review.' }, { status: 404 });
    }

    const inserted = await client.query(
      `INSERT INTO refund_requests(order_id, user_id, payment_id, reason)
       VALUES($1, $2, $3, $4)
       ON CONFLICT (order_id) WHERE status IN ('requested','under_review','approved','processing')
       DO NOTHING
       RETURNING id, status, requested_at`,
      [input.orderId, session.user.id, order.rows[0].payment_id, input.reason],
    );
    if (!inserted.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'A refund or cancellation request is already open for this order.' }, { status: 409 });
    }
    await client.query('COMMIT');
    return NextResponse.json({ request: inserted.rows[0], message: 'Your request was recorded for review. This response does not mean a refund has been approved or issued.' }, { status: 201 });
  } catch {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Could not submit the refund request. Please try again later.' }, { status: 500 });
  } finally {
    client.release();
  }
}
