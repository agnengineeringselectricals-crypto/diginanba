import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  // Fail closed: never process payment events when the webhook secret is absent.
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'Payment webhook is not configured' }, { status: 503 });
  }
  if (request.headers.get('x-diginanba-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }

  const event = body as Record<string, unknown>;
  const eventId = typeof event.eventId === 'string' ? event.eventId.trim() : '';
  const type = typeof event.type === 'string' ? event.type.trim() : '';
  const paymentId = typeof event.paymentId === 'string' ? event.paymentId.trim() : '';
  if (!eventId || !type || eventId.length > 255 || type.length > 120) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO payment_events (payment_id, provider, event_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [paymentId || null, typeof event.provider === 'string' ? event.provider.slice(0, 80) : 'demo', eventId, type, JSON.stringify(event)],
    );

    if (inserted.rowCount && paymentId && ['payment.succeeded', 'payment.failed'].includes(type)) {
      const status = type === 'payment.succeeded' ? 'succeeded' : 'failed';
      await client.query(
        'UPDATE payments SET status = $1, updated_at = now() WHERE id = $2',
        [status, paymentId],
      );
      const payment = await client.query('SELECT order_id FROM payments WHERE id = $1', [paymentId]);
      if (payment.rows[0]) {
        await client.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          [status === 'succeeded' ? 'paid' : 'payment_failed', payment.rows[0].order_id],
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ received: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Payment webhook processing failed');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
