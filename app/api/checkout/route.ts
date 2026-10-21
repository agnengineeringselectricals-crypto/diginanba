import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPendingOrder } from '@/lib/server/checkout';
import { createRazorpayOrder, paymentsEnabled, razorpayConfig } from '@/lib/server/razorpay';

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
    const body = schema.parse(await req.json());
    const livePayments = paymentsEnabled();
    const config = razorpayConfig();

    // Never silently fall back to demo mode after the operator enables live payments.
    if (livePayments && !config) {
      return NextResponse.json({ error: 'Payments are enabled but Razorpay server credentials are incomplete. Please contact support.' }, { status: 503 });
    }
    // This Indian merchant integration is deliberately limited to INR until
    // international processing and settlement are explicitly enabled and tested.
    if (livePayments && body.market !== 'IN') {
      return NextResponse.json({ error: 'Live checkout is currently available only for the India storefront (INR). Please select India or try again later.' }, { status: 409 });
    }

    const order = await createPendingOrder(session.user.id, body.market, body.items);
    if (!livePayments) {
      return NextResponse.json({
        orderId: order.id,
        currency: order.currency,
        subtotalMinor: order.subtotalMinor,
        paymentMode: 'demo',
      });
    }

    let providerOrder: Awaited<ReturnType<typeof createRazorpayOrder>>;
    try {
      providerOrder = await createRazorpayOrder({
        amount: order.subtotalMinor,
        currency: 'INR',
        receipt: 'dn_' + order.id.replace(/-/g, '').slice(0, 32),
      });
      await db.query(
        `INSERT INTO payments(order_id, provider, provider_order_id, currency_code, amount_minor, status, raw_reference)
         VALUES($1, 'razorpay', $2, 'INR', $3, 'pending', $4::jsonb)`,
        [order.id, providerOrder.id, order.subtotalMinor, JSON.stringify({ receipt: 'dn_' + order.id.replace(/-/g, '').slice(0, 32) })],
      );
    } catch (error) {
      await db.query("UPDATE orders SET status = 'checkout_failed' WHERE id = $1 AND status = 'pending'", [order.id]).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({
      orderId: order.id,
      currency: 'INR',
      subtotalMinor: order.subtotalMinor,
      paymentMode: 'razorpay',
      razorpay: {
        keyId: config!.keyId,
        orderId: providerOrder.id,
        amount: providerOrder.amount,
        currency: providerOrder.currency,
        name: 'DigiNanba',
        description: 'Digital product purchase',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid checkout details' }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout failed' }, { status: 400 });
  }
}
