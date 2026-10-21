import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPendingOrder } from '@/lib/server/checkout';
import { createRazorpayOrder, razorpayConfig } from '@/lib/server/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  market: z.enum(['US', 'UK', 'IN']),
  items: z.array(z.object({
    slug: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(50),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Payments stay closed unless both the payment and secure-delivery gates are enabled.
  const razorpay = razorpayConfig();
  if (process.env.PAYMENTS_ENABLED !== 'true' || process.env.DIGITAL_DELIVERY_ENABLED !== 'true' || !razorpay) {
    return NextResponse.json({
      error: 'Online checkout is temporarily unavailable. No payment has been taken.',
    }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid checkout request.' }, { status: 400 });
  }

  // The current provider adapter has only been validated for INR. Do not charge a
  // US/UK customer in a different currency or silently convert the displayed price.
  if (input.market !== 'IN') {
    return NextResponse.json({
      error: 'Online payment is currently available for India (INR) orders only. Please do not retry this cart in another currency.',
    }, { status: 400 });
  }

  let orderId: string | null = null;
  try {
    const order = await createPendingOrder(session.user.id, input.market, input.items);
    orderId = order.id;

    const providerOrder = await createRazorpayOrder({
      amount: order.subtotalMinor,
      currency: 'INR',
      receipt: order.id,
    });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO payments
           (order_id, provider, provider_order_id, currency_code, amount_minor, status, raw_reference)
         VALUES ($1, 'razorpay', $2, 'INR', $3, 'pending', $4::jsonb)`,
        [order.id, providerOrder.id, order.subtotalMinor, JSON.stringify({ receipt: order.id })],
      );
      await client.query(
        `UPDATE orders SET status = 'payment_pending'
         WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
        [order.id, session.user.id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      orderId: order.id,
      paymentMode: 'razorpay',
      razorpay: {
        keyId: razorpay.keyId,
        orderId: providerOrder.id,
        amount: providerOrder.amount,
        currency: providerOrder.currency,
        name: 'DigiNanba',
        description: 'Digital product order',
      },
    });
  } catch {
    if (orderId) {
      await db.query(
        `UPDATE orders SET status = 'checkout_failed'
         WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'payment_pending')`,
        [orderId, session.user.id],
      ).catch(() => undefined);
    }
    return NextResponse.json({
      error: 'We could not prepare secure checkout. No successful payment has been confirmed; please check your order status before retrying.',
    }, { status: 502 });
  }
}
