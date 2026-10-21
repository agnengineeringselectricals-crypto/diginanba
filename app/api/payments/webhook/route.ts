import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyHexSignature } from '@/lib/server/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RazorpayEvent = {
  event?: string;
  payload?: { payment?: { entity?: {
    id?: string;
    order_id?: string;
    amount?: number;
    currency?: string;
    status?: string;
  } } };
};

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Razorpay webhook is not configured' }, { status: 503 });

  // Verify the exact raw request body before parsing it.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!verifyHexSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  const eventId = req.headers.get('x-razorpay-event-id')?.trim();
  if (!eventId || eventId.length > 200) {
    return NextResponse.json({ error: 'Missing or invalid Razorpay event ID' }, { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = event.event;
  if (!['payment.captured', 'payment.failed'].includes(String(eventType))) {
    // Acknowledge unrelated signed events so Razorpay does not retry forever.
    return NextResponse.json({ received: true, ignored: true });
  }
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id || !Number.isSafeInteger(payment.amount) || !payment.currency) {
    return NextResponse.json({ error: 'Incomplete payment event' }, { status: 400 });
  }
  if ((eventType === 'payment.captured' && payment.status !== 'captured') ||
      (eventType === 'payment.failed' && payment.status !== 'failed')) {
    return NextResponse.json({ error: 'Payment event status mismatch' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT p.id AS payment_id, p.order_id, p.amount_minor, p.currency_code, p.status AS payment_status,
              o.user_id, o.status AS order_status
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.provider = 'razorpay' AND p.provider_order_id = $1
       FOR UPDATE OF p, o`,
      [payment.order_id],
    );
    const record = result.rows[0];
    if (!record) {
      await client.query('ROLLBACK');
      // Unknown orders are not recorded as successful events; return an error for investigation.
      return NextResponse.json({ error: 'Unknown Razorpay order' }, { status: 404 });
    }
    if (Number(payment.amount) !== Number(record.amount_minor) ||
        payment.currency !== String(record.currency_code).trim()) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Payment amount or currency mismatch' }, { status: 409 });
    }

    const inserted = await client.query(
      `INSERT INTO payment_events(payment_id, provider, event_id, event_type, payload)
       VALUES($1, 'razorpay', $2, $3, $4::jsonb)
       ON CONFLICT(event_id) DO NOTHING RETURNING id`,
      [record.payment_id, eventId, String(eventType), JSON.stringify(event)],
    );
    if (!inserted.rowCount) {
      await client.query('COMMIT');
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (record.payment_status === 'succeeded' || record.payment_status === 'failed') {
      await client.query('COMMIT');
      return NextResponse.json({ received: true, ignored: 'payment_already_terminal' });
    }

    if (eventType === 'payment.captured') {
      await client.query(
        `UPDATE payments SET provider_payment_id = $1, status = 'succeeded', updated_at = now()
         WHERE id = $2 AND status = 'pending'`,
        [payment.id, record.payment_id],
      );
      await client.query(
        `UPDATE orders SET status = 'paid' WHERE id = $1 AND status IN ('pending', 'payment_pending')`,
        [record.order_id],
      );
      await client.query(
        `INSERT INTO entitlements(user_id, order_item_id, status)
         SELECT o.user_id, oi.id, 'active'
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1
         ON CONFLICT(user_id, order_item_id) DO NOTHING`,
        [record.order_id],
      );
    } else {
      // A failed payment attempt does not mean the Razorpay order itself is terminal.
      // Razorpay Checkout can retry another payment against the same provider order.
      // Record the signed event above, but keep the order/payment pending so a later
      // captured event or successful client verification can complete fulfillment.
    }

    await client.query('COMMIT');
    return NextResponse.json({ received: true });
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
