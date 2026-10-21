import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPendingOrder } from '@/lib/server/checkout';
import { createRazorpayOrder } from '@/lib/server/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  market: z.enum(['US', 'UK', 'IN']),
  items: z.array(z.object({ slug: z.string().min(1), quantity: z.number().int().min(1).max(10) })).min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  try {
    // Fail before creating any order records while the payment gate is closed.
    if (process.env.RAZORPAY_CHECKOUT_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Online payments are not enabled yet. No order or payment was created.' }, { status: 503 });
    }
    const body = schema.parse(await req.json());
    const order = await createPendingOrder(session.user.id, body.market, body.items);

    const providerOrder = await createRazorpayOrder({
      amount: order.subtotalMinor,
      currency: order.currency,
      receipt: order.id,
    });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO payments(order_id, provider, provider_order_id, currency_code, amount_minor, status, raw_reference)
         VALUES($1, 'razorpay', $2, $3, $4, 'pending', $5)`,
        [order.id, providerOrder.id, order.currency, order.subtotalMinor, { receipt: order.id }],
      );
      await client.query(
        "UPDATE orders SET status = 'payment_pending' WHERE id = $1 AND status = 'pending'",
        [order.id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: providerOrder.id,
      keyId: providerOrder.keyId,
      amount: providerOrder.amount,
      currency: providerOrder.currency,
      paymentMode: 'razorpay',
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Checkout failed',
    }, { status: 400 });
  }
}
