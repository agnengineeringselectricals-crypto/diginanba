import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPendingOrder } from '@/lib/server/checkout';
import { getPaymentProvider } from '@/lib/payments/provider';

const schema=z.object({market:z.enum(['US','UK']),items:z.array(z.object({slug:z.string().min(1),quantity:z.number().int().min(1).max(10)})).min(1)});

export async function POST(req:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Authentication required'},{status:401});
  try{
    const body=schema.parse(await req.json());
    const order=await createPendingOrder(session.user.id,body.market,body.items);
    const payment=getPaymentProvider();
    const paymentSession=await payment.createCheckout({orderId:order.id,amountMinor:order.subtotalMinor,currency:order.currency,customerEmail:order.customerEmail});
    if(paymentSession.externalId){
      await db.query('UPDATE payments SET provider_payment_id=$1,updated_at=now() WHERE id=$2',[paymentSession.externalId,order.paymentId]);
    }
    return NextResponse.json({
      orderId:order.id,
      currency:order.currency,
      subtotalMinor:order.subtotalMinor,
      paymentId:order.paymentId,
      paymentMode:paymentSession.status,
      provider:paymentSession.provider,
      externalId:paymentSession.externalId,
      clientSecret:paymentSession.clientSecret,
      demo:paymentSession.status==='demo',
    });
  }catch(e:any){
    return NextResponse.json({error:e?.message||'Checkout failed'},{status:400});
  }
}
