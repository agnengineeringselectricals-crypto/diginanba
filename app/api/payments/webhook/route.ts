import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchRazorpayPayment, verifyRazorpayWebhookSignature } from '@/lib/server/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Verify the provider signature against the exact raw request body before parsing.
  const rawBody = await req.text();
  if (!verifyRazorpayWebhookSignature(rawBody, req.headers.get('x-razorpay-signature'))) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let event: Record<string, any>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
    event = parsed;
  } catch {
    return NextResponse.json({ error: 'Invalid event body' }, { status: 400 });
  }

  const eventId = req.headers.get('x-razorpay-event-id')?.trim();
  const eventType = typeof event.event === 'string' ? event.event : '';
  if (!eventId || eventId.length > 200) return NextResponse.json({ error: 'Missing event ID' }, { status: 400 });
  if (!['payment.captured', 'payment.failed'].includes(eventType)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const entity = event.payload?.payment?.entity;
  const providerPaymentId = typeof entity?.id === 'string' ? entity.id : '';
  const providerOrderId = typeof entity?.order_id === 'string' ? entity.order_id : '';
  if (!providerPaymentId || !providerOrderId) {
    return NextResponse.json({ error: 'Missing payment identifiers' }, { status: 400 });
  }

  let verified;
  try { verified = await fetchRazorpayPayment(providerPaymentId); }
  catch { return NextResponse.json({ error: 'Could not verify provider payment' }, { status: 502 }); }
  if (verified.id !== providerPaymentId || verified.order_id !== providerOrderId) {
    return NextResponse.json({ error: 'Provider payment identifiers do not match' }, { status: 409 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT p.id AS payment_id, p.order_id, p.amount_minor, p.currency_code, p.status
       FROM payments p WHERE p.provider = 'razorpay' AND p.provider_order_id = $1
       FOR UPDATE`,
      [providerOrderId],
    );
    const payment = result.rows[0];
    if (!payment) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Payment order not found' }, { status: 404 });
    }

    const inserted = await client.query(
      `INSERT INTO payment_events(payment_id, provider, event_id, event_type, payload)
       VALUES($1, 'razorpay', $2, $3, $4)
       ON CONFLICT(event_id) DO NOTHING RETURNING id`,
      [payment.payment_id, eventId, eventType, event],
    );
    if (!inserted.rowCount) {
      await client.query('COMMIT');
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (Number(verified.amount) !== Number(payment.amount_minor) ||
        verified.currency !== String(payment.currency_code).trim()) {
      await client.query('COMMIT');
      return NextResponse.json({ received: true, ignored: 'amount_or_currency_mismatch' });
    }

    if (eventType === 'payment.captured') {
      if (verified.status !== 'captured' || verified.captured !== true) {
        await client.query('COMMIT');
        return NextResponse.json({ received: true, ignored: 'payment_not_captured' });
      }
      await client.query(
        `UPDATE payments SET provider_payment_id = $1, status = 'succeeded', updated_at = now()
         WHERE id = $2 AND status <> 'succeeded'`,
        [providerPaymentId, payment.payment_id],
      );
      await client.query(
        `UPDATE orders SET status = 'paid' WHERE id = $1 AND status IN ('pending','payment_pending')`,
        [payment.order_id],
      );
    } else if (verified.status === 'failed') {
      await client.query(
        `UPDATE payments SET provider_payment_id = $1, status = 'failed', updated_at = now()
         WHERE id = $2 AND status NOT IN ('succeeded','failed')`,
        [providerPaymentId, payment.payment_id],
      );
      await client.query(
        `UPDATE orders SET status = 'payment_failed' WHERE id = $1 AND status IN ('pending','payment_pending')`,
        [payment.order_id],
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ received: true });
  } catch {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
