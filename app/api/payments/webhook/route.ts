import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRazorpayWebhook, verifyHmacSignature } from '@/lib/payments/webhook';

export async function POST(req:Request){
  const rawBody=await req.text();
  const provider=(req.headers.get('x-diginanba-provider')||'razorpay').toLowerCase();
  const signature=provider==='razorpay'?req.headers.get('x-razorpay-signature'):req.headers.get('x-diginanba-signature');
  const verified=provider==='razorpay'
    ? verifyRazorpayWebhook(rawBody,signature)
    : verifyHmacSignature(rawBody,signature,process.env.PAYMENT_WEBHOOK_SECRET);
  if(!verified)return NextResponse.json({error:'Unauthorized'},{status:401});

  let body:any;
  try{body=JSON.parse(rawBody)}catch{return NextResponse.json({error:'Invalid event payload'},{status:400})}

  const eventId=String(req.headers.get('x-razorpay-event-id')||body.id||body.eventId||'');
  const type=String(body.event||body.type||'');
  const providerPaymentId=String(body?.payload?.payment?.entity?.id||body.paymentId||'');
  const providerOrderId=String(body?.payload?.payment?.entity?.order_id||body?.payload?.order?.entity?.id||body.providerOrderId||'');

  if(!eventId||!type)return NextResponse.json({error:'Invalid event'},{status:400});

  const client=await db.connect();
  try{
    await client.query('BEGIN');
    const payment=await client.query(
      `SELECT p.id,p.order_id,o.user_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.provider=$1 AND (p.provider_payment_id=$2 OR p.provider_payment_id=$3) LIMIT 1`,
      [provider,providerPaymentId,providerOrderId]);
    const paymentId=payment.rows[0]?.id||null;
    const orderId=payment.rows[0]?.order_id||null;
    const userId=payment.rows[0]?.user_id||null;
    const event=await client.query(
      `INSERT INTO payment_events(payment_id,provider,event_id,event_type,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_id) DO NOTHING RETURNING id`,
      [paymentId,provider,eventId,type,body]);
    if(event.rowCount){
      if(orderId&&['payment.captured','order.paid','payment.succeeded'].includes(type)){
        await client.query('UPDATE payments SET status=$1,updated_at=now() WHERE id=$2',['succeeded',paymentId]);
        await client.query('UPDATE orders SET status=$1 WHERE id=$2',['paid',orderId]);
        if(userId){
          await client.query(
            `INSERT INTO entitlements(user_id,order_item_id,status) SELECT $1,oi.id,'active' FROM order_items oi WHERE oi.order_id=$2 ON CONFLICT(user_id,order_item_id) DO UPDATE SET status='active'`,
            [userId,orderId]);
        }
      }else if(orderId&&['payment.failed','payment.cancelled'].includes(type)){
        await client.query('UPDATE payments SET status=$1,updated_at=now() WHERE id=$2',['failed',paymentId]);
        await client.query('UPDATE orders SET status=$1 WHERE id=$2',['payment_failed',orderId]);
      }
    }
    await client.query('COMMIT');
    return NextResponse.json({received:true,duplicate:!event.rowCount});
  }catch(e){
    await client.query('ROLLBACK');
    return NextResponse.json({error:'Webhook processing failed'},{status:500});
  }finally{client.release();}
}
