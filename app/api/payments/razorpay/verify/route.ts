import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fetchRazorpayPayment, razorpayConfig, verifyHexSignature } from '@/lib/server/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const config = razorpayConfig();
  if (!config || process.env.PAYMENTS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Live payment verification is not enabled' }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment verification details' }, { status: 400 });
  const input = parsed.data;
  if (!verifyHexSignature(input.razorpay_order_id + '|' + input.razorpay_payment_id, input.razorpay_signature, config.keySecret)) {
    return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT p.id AS payment_id, p.order_id, p.provider_order_id, p.amount_minor, p.currency_code, p.status AS payment_status,
              o.user_id, o.status AS order_status
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.order_id = $1 AND p.provider = 'razorpay' AND p.provider_order_id = $2
       FOR UPDATE OF p, o`,
      [input.orderId, input.razorpay_order_id],
    );
    const record = result.rows[0];
    if (!record || String(record.user_id) !== String(session.user.id)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Payment order not found for this account' }, { status: 404 });
    }
    if (record.payment_status === 'succeeded' && record.order_status === 'paid') {
      await client.query('COMMIT');
      return NextResponse.json({ verified: true, orderId: input.orderId, alreadyProcessed: true });
    }
    if (record.payment_status !== 'pending' || !['pending', 'payment_pending'].includes(String(record.order_status))) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'This order is not awaiting payment' }, { status: 409 });
    }

    const providerPayment = await fetchRazorpayPayment(input.razorpay_payment_id);
    if (
      providerPayment.id !== input.razorpay_payment_id ||
      providerPayment.order_id !== input.razorpay_order_id ||
      providerPayment.status !== 'captured' ||
      providerPayment.captured !== true ||
      Number(providerPayment.amount) !== Number(record.amount_minor) ||
      providerPayment.currency !== String(record.currency_code).trim()
    ) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Razorpay has not confirmed the expected captured amount and currency' }, { status: 409 });
    }

    await client.query(
      `UPDATE payments SET provider_payment_id = $1, status = 'succeeded', updated_at = now()
       WHERE id = $2 AND status = 'pending'`,
      [input.razorpay_payment_id, record.payment_id],
    );
    await client.query(
      `UPDATE orders SET status = 'paid' WHERE id = $1 AND status IN ('pending', 'payment_pending')`,
      [input.orderId],
    );
    await client.query(
      `INSERT INTO entitlements(user_id, order_item_id, status)
       SELECT o.user_id, oi.id, 'active'
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       ON CONFLICT(user_id, order_item_id) DO NOTHING`,
      [input.orderId],
    );
    await client.query(
      `INSERT INTO payment_events(payment_id, provider, event_id, event_type, payload)
       VALUES($1, 'razorpay', $2, 'checkout.signature_verified', $3::jsonb)
       ON CONFLICT(event_id) DO NOTHING`,
      [record.payment_id, 'checkout_verify_' + input.razorpay_payment_id, JSON.stringify({ razorpay_order_id: input.razorpay_order_id, razorpay_payment_id: input.razorpay_payment_id })],
    );
    await client.query('COMMIT');
    return NextResponse.json({ verified: true, orderId: input.orderId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment verification failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
