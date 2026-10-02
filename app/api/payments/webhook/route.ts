import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
export async function POST(req:Request){
  const secret=process.env.PAYMENT_WEBHOOK_SECRET;
  if(secret && req.headers.get('x-diginanba-webhook-secret')!==secret) return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json();
  const eventId=String(body.eventId||''); const type=String(body.type||''); const paymentId=String(body.paymentId||'');
  if(!eventId||!type) return NextResponse.json({error:'Invalid event'},{status:400});
  const client=await db.connect();
  try { await client.query('BEGIN'); const ev=await client.query(`INSERT INTO payment_events(payment_id,provider,event_id,event_type,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_id) DO NOTHING RETURNING id`,[paymentId||null,String(body.provider||'demo'),eventId,type,body]); if(ev.rowCount){ if(paymentId && ['payment.succeeded','payment.failed'].includes(type)){const status=type==='payment.succeeded'?'succeeded':'failed'; await client.query('UPDATE payments SET status=$1,updated_at=now() WHERE id=$2',[status,paymentId]); const p=await client.query('SELECT order_id FROM payments WHERE id=$1',[paymentId]); if(p.rows[0]) await client.query('UPDATE orders SET status=$1 WHERE id=$2',[status==='succeeded'?'paid':'payment_failed',p.rows[0].order_id]);} } await client.query('COMMIT'); return NextResponse.json({received:true}); }
  catch(e){await client.query('ROLLBACK');return NextResponse.json({error:'Webhook processing failed'},{status:500});} finally{client.release();}
}
