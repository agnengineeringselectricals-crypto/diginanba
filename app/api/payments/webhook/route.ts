import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supportedEvents = new Set(['payment.succeeded', 'payment.failed']);

function secretMatches(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  // This is a private, shared-secret relay endpoint, not a provider-native
  // webhook verifier. Do not connect a payment provider directly until its
  // signature verification and raw-body requirements are implemented.
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Payment webhook is not configured' }, { status: 503 });
  }
  if (!secretMatches(req.headers.get('x-diginanba-webhook-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid event body' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const eventId = typeof input.eventId === 'string' ? input.eventId.trim() : '';
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  const paymentId = typeof input.paymentId === 'string' ? input.paymentId.trim() : '';
  const provider = typeof input.provider === 'string' ? input.provider.trim() : 'internal-relay';

  if (!eventId || eventId.length > 200 || !paymentId || paymentId.length > 200 ||
      !provider || provider.length > 80 || !supportedEvents.has(type)) {
    return NextResponse.json({ error: 'Invalid or unsupported payment event' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Lock the payment before accepting an event. Unknown IDs must never
    // create event records that could be mistaken for processed payments.
    const paymentResult = await client.query(
      'SELECT id, order_id, status FROM payments WHERE id = $1 FOR UPDATE',
      [paymentId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const eventResult = await client.query(
      `INSERT INTO payment_events(payment_id, provider, event_id, event_type, payload)
       VALUES($1, $2, $3, $4, $5)
       ON CONFLICT(event_id) DO NOTHING
       RETURNING id`,
      [paymentId, provider, eventId, type, body],
    );

    if (!eventResult.rowCount) {
      await client.query('COMMIT');
      return NextResponse.json({ received: true, duplicate: true });
    }

    const currentStatus = String(payment.status);
    if (currentStatus === 'succeeded' || currentStatus === 'failed') {
      // Terminal payment states are immutable; record the event for audit,
      // but do not let a late/out-of-order event rewrite the order.
      await client.query('COMMIT');
      return NextResponse.json({ received: true, ignored: 'payment_already_terminal' });
    }

    const nextStatus = type === 'payment.succeeded' ? 'succeeded' : 'failed';
    const nextOrderStatus = nextStatus === 'succeeded' ? 'paid' : 'payment_failed';

    await client.query(
      'UPDATE payments SET status = $1, updated_at = now() WHERE id = $2',
      [nextStatus, paymentId],
    );
    await client.query(
      'UPDATE orders SET status = $1 WHERE id = $2 AND status IN (\'pending\', \'payment_pending\')',
      [nextOrderStatus, payment.order_id],
    );

    await client.query('COMMIT');
    return NextResponse.json({ received: true });
  } catch {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
