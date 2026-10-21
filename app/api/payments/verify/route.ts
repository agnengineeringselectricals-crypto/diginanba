import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fetchRazorpayPayment, verifyRazorpayCheckoutSignature } from '@/lib/server/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  let input: z.infer<typeof schema>;
  try { input = schema.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Invalid payment confirmation' }, { status: 400 }); }

  if (!verifyRazorpayCheckoutSignature({
    orderId: input.razorpay_order_id,
    paymentId: input.razorpay_payment_id,
    signature: input.razorpay_signature,
  })) return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });

  let providerPayment;
  try { providerPayment = await fetchRazorpayPayment(input.razorpay_payment_id); }
  catch { return NextResponse.json({ error: 'Unable to verify payment with provider' }, { status: 502 }); }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT p.id AS payment_id, p.order_id, p.provider_order_id, p.amount_minor,
              p.currency_code, p.status, o.user_id
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.order_id = $1 AND p.provider = 'razorpay'
       FOR UPDATE OF p, o`,
      [input.orderId],
    );
    const payment = result.rows[0];
    if (!payment || String(payment.user_id) !== String(session.user.id)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (payment.provider_order_id !== input.razorpay_order_id ||
        providerPayment.order_id !== input.razorpay_order_id ||
        providerPayment.id !== input.razorpay_payment_id ||
        Number(providerPayment.amount) !== Number(payment.amount_minor) ||
        providerPayment.currency !== String(payment.currency_code).trim() ||
        providerPayment.status !== 'captured' || providerPayment.captured !== true) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Payment does not match this order or is not captured' }, { status: 409 });
    }

    await client.query(
      `UPDATE payments SET provider_payment_id = $1, status = 'succeeded', updated_at = now()
       WHERE id = $2 AND status IN ('pending','created')`,
      [input.razorpay_payment_id, payment.payment_id],
    );
    await client.query(
      `UPDATE orders SET status = 'paid' WHERE id = $1 AND status IN ('pending','payment_pending')`,
      [input.orderId],
    );
    await client.query('COMMIT');
    return NextResponse.json({ verified: true, orderId: input.orderId });
  } catch {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
