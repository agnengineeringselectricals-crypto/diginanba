import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
export const runtime='nodejs';
const schema=z.object({
 connectionId:z.string().uuid(), fulfilmentMethod:z.enum(['delivery','pickup']),
 requestedFulfilmentAt:z.string().datetime().optional().nullable(), customerNote:z.string().max(2000).optional(),
 items:z.array(z.object({listingId:z.string().uuid().optional().nullable(),itemName:z.string().trim().min(1).max(240),quantity:z.number().positive().max(100000),unit:z.string().trim().min(1).max(40).default('piece'),note:z.string().max(500).optional()})).min(1).max(100)
});
export async function POST(req:Request){
 const session=await auth();const userId=session?.user?.id;if(!userId)return NextResponse.json({error:'Sign in to send an order request.'},{status:401});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Check the items and quantities in your list.'},{status:400});
 const input=parsed.data,client=await db.connect();
 try{
  await client.query('BEGIN');
  const cr=await client.query("SELECT c.id,c.workspace_account_id,c.owner_user_id,a.workspace_ref AS business_id,b.business_name,b.country_code,b.door_delivery_enabled,b.self_collection_enabled,b.default_delivery_fee FROM marketplace_customer_workspace_connections c JOIN marketplace_customer_accounts a ON a.id=c.workspace_account_id JOIN marketplace_businesses b ON b.id=a.workspace_ref WHERE c.id=$1 AND c.customer_user_id=$2 AND c.status='connected' AND a.status='active' AND b.business_type='shop' FOR UPDATE OF c",[input.connectionId,userId]);
  if(!cr.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'Connect with this shop before placing an order request.'},{status:404});}
  const shop=cr.rows[0];
  if(input.fulfilmentMethod==='delivery'&&!shop.door_delivery_enabled){await client.query('ROLLBACK');return NextResponse.json({error:'This shop has not enabled door delivery. Choose self-collection.'},{status:400});}
  if(input.fulfilmentMethod==='pickup'&&!shop.self_collection_enabled){await client.query('ROLLBACK');return NextResponse.json({error:'This shop has not enabled self-collection.'},{status:400});}
  const cv=await client.query("INSERT INTO marketplace_conversations(connection_id,workspace_account_id,owner_user_id,customer_user_id) VALUES($1,$2,$3,$4) ON CONFLICT(connection_id) DO UPDATE SET updated_at=now() RETURNING id",[cr.rows[0].id,shop.workspace_account_id,shop.owner_user_id,userId]);
  const currency=shop.country_code==='IN'?'INR':shop.country_code==='GB'?'GBP':shop.country_code==='AU'?'AUD':shop.country_code==='CA'?'CAD':'USD';
  const existing=await client.query("SELECT o.id FROM marketplace_shop_order_requests o WHERE o.conversation_id=$1 AND o.customer_user_id=$2 AND o.status NOT IN ('completed','cancelled','rejected') AND NOT EXISTS(SELECT 1 FROM marketplace_shop_order_items i WHERE i.order_request_id=o.id) ORDER BY o.created_at DESC LIMIT 1 FOR UPDATE",[cv.rows[0].id,userId]);
  const or=existing.rowCount?await client.query("UPDATE marketplace_shop_order_requests SET fulfilment_method=$2,requested_fulfilment_at=$3,customer_note=COALESCE($4,customer_note),delivery_fee=$5,updated_at=now() WHERE id=$1 RETURNING id",[existing.rows[0].id,input.fulfilmentMethod,input.requestedFulfilmentAt||null,input.customerNote||null,input.fulfilmentMethod==='delivery'?shop.default_delivery_fee:0]):await client.query("INSERT INTO marketplace_shop_order_requests(conversation_id,customer_user_id,owner_user_id,business_id,status,fulfilment_method,requested_fulfilment_at,customer_note,currency_code,delivery_fee) VALUES($1,$2,$3,$4,'sent',$5,$6,$7,$8,$9) RETURNING id",[cv.rows[0].id,userId,shop.owner_user_id,shop.business_id,input.fulfilmentMethod,input.requestedFulfilmentAt||null,input.customerNote||null,currency,input.fulfilmentMethod==='delivery'?shop.default_delivery_fee:0]);
  const lines:string[]=[];
  for(const item of input.items){
   let listingId=null,name=item.itemName,price=null;
   if(item.listingId){const lr=await client.query("SELECT id,title,price_amount FROM marketplace_listings WHERE id=$1 AND business_id=$2 AND listing_status='published'",[item.listingId,shop.business_id]);if(!lr.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'A selected catalogue item is no longer available. Refresh the shop catalogue.'},{status:409});}listingId=lr.rows[0].id;name=lr.rows[0].title;price=lr.rows[0].price_amount;}
   await client.query("INSERT INTO marketplace_shop_order_items(order_request_id,listing_id,item_name,quantity,unit,unit_price,line_total,availability_status,owner_note) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $6 IS NULL THEN NULL ELSE $4*$6 END,'pending',$7)",[or.rows[0].id,listingId,name,item.quantity,item.unit,price,item.note||null]);
   lines.push('- '+name+' × '+item.quantity+' '+item.unit);
  }
  const body=['New order request for '+shop.business_name+'.','Fulfilment: '+(input.fulfilmentMethod==='delivery'?'Door delivery requested':'Self-collection requested')+'.',input.requestedFulfilmentAt?'Preferred time: '+new Date(input.requestedFulfilmentAt).toLocaleString()+'.':'',...lines,input.customerNote?'Customer note: '+input.customerNote:''].filter(Boolean).join('\n');
  await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type,body,metadata) VALUES($1,$2,'order_update',$3,jsonb_build_object('orderRequestId',$4::text))",[cv.rows[0].id,userId,body,or.rows[0].id]);
  await client.query('UPDATE marketplace_conversations SET last_message_at=now(),updated_at=now() WHERE id=$1',[cv.rows[0].id]);
  await client.query('COMMIT');return NextResponse.json({orderRequestId:or.rows[0].id,conversationId:cv.rows[0].id,status:'sent',message:'Order request sent. The owner will confirm availability, the final bill and the fulfilment time.'},{status:201});
 }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('create shop order request',e);return NextResponse.json({error:'Could not send the order request.'},{status:503});}finally{client.release();}
}
