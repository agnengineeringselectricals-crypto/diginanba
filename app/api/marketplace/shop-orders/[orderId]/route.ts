import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
export const runtime='nodejs';
const schema=z.object({
 status:z.enum(['owner_reviewing','clarification_needed','confirmed','preparing','ready','completed','cancelled','rejected']).optional(),
 ownerNote:z.string().max(2000).optional(),
 confirmedFulfilmentAt:z.string().datetime().optional().nullable(),
 items:z.array(z.object({id:z.string().uuid().optional(),itemName:z.string().trim().min(1).max(240),quantity:z.number().positive().max(100000),unit:z.string().trim().min(1).max(40),availabilityStatus:z.enum(['available','unavailable','substitute_suggested']),unitPrice:z.number().nonnegative().max(100000000).nullable().optional(),ownerNote:z.string().max(500).optional()})).max(100).optional()
});
function esc(v:unknown){return String(v??'').replace(/[&<>"]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'} as Record<string,string>)[c];});}
function makePdf(lines:string[]){
 const clean=(s:string)=>s.replace(/[^\x20-\x7E]/g,'?').replace(/([\\()])/g,'\\$1');
 const stream=['BT','/F1 10 Tf','48 790 Td'];
 lines.slice(0,42).forEach((line,i)=>{if(i)stream.push('0 -17 Td');stream.push('('+clean(line).slice(0,145)+') Tj');});
 stream.push('ET');const content=stream.join('\n');
 const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(content)+' >>\nstream\n'+content+'\nendstream'];
 let out='%PDF-1.4\n';const offsets=[0];objs.forEach((obj,i)=>{offsets.push(Buffer.byteLength(out));out+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});
 const xref=Buffer.byteLength(out);out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';for(let i=1;i<offsets.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';out+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Buffer.from(out,'ascii');
}
export async function PATCH(req:Request,{params}:{params:Promise<{orderId:string}>}){
 const session=await auth();const userId=session?.user?.id;if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {orderId}=await params;const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Invalid order update.'},{status:400});
 const input=parsed.data,client=await db.connect();
 try{
  await client.query('BEGIN');
  const found=await client.query("SELECT o.*,b.business_name,b.address_line,b.city,b.region,b.phone,c.id AS conversation_id FROM marketplace_shop_order_requests o JOIN marketplace_businesses b ON b.id=o.business_id JOIN marketplace_conversations c ON c.id=o.conversation_id WHERE o.id=$1 AND o.owner_user_id=$2 FOR UPDATE OF o",[orderId,userId]);
  if(!found.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'Order request not found.'},{status:404});}
  const o=found.rows[0];
  if(input.items){for(const item of input.items){
   let upd;
   if(item.id){
    upd=await client.query("UPDATE marketplace_shop_order_items SET item_name=$3,quantity=$4,unit=$5,availability_status=$6,unit_price=CASE WHEN $7::numeric IS NULL THEN unit_price ELSE $7 END,line_total=CASE WHEN $6='available' AND COALESCE($7::numeric,unit_price) IS NOT NULL THEN $4*COALESCE($7::numeric,unit_price) ELSE NULL END,owner_note=$8 WHERE id=$1 AND order_request_id=$2 RETURNING item_name,quantity,unit,availability_status,owner_note",[item.id,orderId,item.itemName,item.quantity,item.unit,item.availabilityStatus,item.unitPrice??null,item.ownerNote||null]);
   }else{
    upd=await client.query("INSERT INTO marketplace_shop_order_items(order_request_id,item_name,quantity,unit,availability_status,unit_price,line_total,owner_note) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $5='available' AND $6 IS NOT NULL THEN $3*$6 ELSE NULL END,$7) RETURNING item_name,quantity,unit,availability_status,owner_note",[orderId,item.itemName,item.quantity,item.unit,item.availabilityStatus,item.unitPrice??null,item.ownerNote||null]);
   }
   if(upd.rowCount&&item.availabilityStatus==='unavailable'){const x=upd.rows[0];const msg=x.item_name+' (requested quantity: '+x.quantity+' '+x.unit+') is currently unavailable.'+(x.owner_note?' '+x.owner_note:'');await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type,body,metadata) VALUES($1,$2,'order_update',$3,jsonb_build_object('orderRequestId',$4::text,'itemUnavailable',true))",[o.conversation_id,userId,msg,orderId]);}
   if(upd.rowCount&&item.availabilityStatus==='substitute_suggested'){const x=upd.rows[0];const msg='For '+x.item_name+', the shop suggests an alternative.'+(x.owner_note?' '+x.owner_note:'')+' Please reply in chat if you would like to accept it.';await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type,body,metadata) VALUES($1,$2,'order_update',$3,jsonb_build_object('orderRequestId',$4::text,'substituteSuggested',true))",[o.conversation_id,userId,msg,orderId]);}
  }}

  const sum=await client.query("SELECT COALESCE(SUM(line_total),0)::numeric AS subtotal FROM marketplace_shop_order_items WHERE order_request_id=$1",[orderId]);
  const subtotal=Number(sum.rows[0].subtotal||0),delivery=Number(o.delivery_fee||0),tax=Number(o.tax_amount||0),total=subtotal+delivery+tax;
  const status=input.status||o.status;
  if(status==='ready'||status==='completed'){
   const unresolved=await client.query("SELECT COUNT(*)::int AS count,COUNT(*) FILTER(WHERE availability_status='pending' OR (availability_status='available' AND unit_price IS NULL))::int AS unresolved FROM marketplace_shop_order_items WHERE order_request_id=$1",[orderId]);
   if(Number(unresolved.rows[0].count)===0||Number(unresolved.rows[0].unresolved)>0){await client.query('ROLLBACK');return NextResponse.json({error:'Before completing this order, mark every item available/unavailable and enter a price for each available item.'},{status:400});}
  }
  await client.query("UPDATE marketplace_shop_order_requests SET status=$2,owner_note=COALESCE($3,owner_note),confirmed_fulfilment_at=COALESCE($4,confirmed_fulfilment_at),subtotal=$5,total_amount=$6,updated_at=now() WHERE id=$1",[orderId,status,input.ownerNote||null,input.confirmedFulfilmentAt||null,subtotal,total]);
  if(input.ownerNote&&status==='clarification_needed')await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type,body,metadata) VALUES($1,$2,'order_update',$3,jsonb_build_object('orderRequestId',$4::text))",[o.conversation_id,userId,input.ownerNote,orderId]);
  if(input.status)await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type,body,metadata) VALUES($1,$2,'order_update',$3,jsonb_build_object('orderRequestId',$4::text,'status',$5::text))",[o.conversation_id,userId,'Order status updated: '+status.replace(/_/g,' ')+'.',orderId,status]);
  let billCreated=false;
  if(status==='ready'||status==='completed'){
   const exists=await client.query('SELECT id FROM marketplace_shop_order_bills WHERE order_request_id=$1',[orderId]);
   if(!exists.rowCount){
    const items=await client.query("SELECT item_name,quantity,unit,unit_price,line_total,availability_status,owner_note FROM marketplace_shop_order_items WHERE order_request_id=$1 ORDER BY created_at",[orderId]);
    const billNo='DN-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+orderId.slice(0,8).toUpperCase();
    const money=(n:number)=>n.toFixed(2);
    const html='<!doctype html><html><head><meta charset="utf-8"><title>Bill '+esc(billNo)+'</title></head><body><h1>'+esc(o.business_name)+'</h1><p>'+esc(o.address_line||'')+' '+esc(o.city||'')+' '+esc(o.region||'')+'<br>'+esc(o.phone||'')+'</p><h2>Customer Bill</h2><p>Bill: '+esc(billNo)+'<br>Date: '+new Date().toISOString()+'</p><table border="1" cellspacing="0" cellpadding="6"><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>'+items.rows.map((x:any)=>'<tr><td>'+esc(x.item_name)+(x.availability_status==='unavailable'?' (Unavailable)':'')+'</td><td>'+esc(x.quantity)+' '+esc(x.unit)+'</td><td>'+(x.unit_price===null?'—':money(Number(x.unit_price)))+'</td><td>'+(x.line_total===null?'—':money(Number(x.line_total)))+'</td></tr>').join('')+'</table><p>Subtotal: '+money(subtotal)+'<br>Delivery: '+money(delivery)+'<br>Tax: '+money(tax)+'<br><strong>Total: '+money(total)+' '+esc(o.currency_code)+'</strong></p><p>Unavailable items are excluded from the payable total.</p></body></html>';
    await client.query("INSERT INTO marketplace_shop_order_bills(order_request_id,bill_number,issued_by,currency_code,subtotal,delivery_fee,tax_amount,total_amount,bill_html) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[orderId,billNo,userId,o.currency_code,subtotal,delivery,tax,total,html]);
    const lines=[o.business_name,'CUSTOMER BILL','Bill: '+billNo,'Date: '+new Date().toLocaleString(),'','Item | Qty | Rate | Amount'];
    items.rows.forEach((x:any)=>lines.push(x.item_name+' | '+x.quantity+' '+x.unit+' | '+(x.unit_price===null?'N/A':money(Number(x.unit_price)))+' | '+(x.line_total===null?'N/A':money(Number(x.line_total)))));
    lines.push('','Subtotal: '+money(subtotal),'Delivery: '+money(delivery),'Tax: '+money(tax),'TOTAL: '+money(total)+' '+o.currency_code,'','Unavailable items are excluded from the payable total.','Thank you for shopping with '+o.business_name+'.');
    const bytes=makePdf(lines);
    const msg=await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type,body,metadata) VALUES($1,$2,'bill',$3,jsonb_build_object('orderRequestId',$4::text,'billNumber',$5::text)) RETURNING id",[o.conversation_id,userId,'Your itemized bill is ready. Please review the attached bill in this chat.',orderId,billNo]);
    await client.query("INSERT INTO marketplace_chat_attachments(message_id,conversation_id,uploaded_by,original_file_name,content_type,size_bytes,content_bytes,purpose) VALUES($1,$2,$3,$4,'application/pdf',$5,$6,'bill')",[msg.rows[0].id,o.conversation_id,userId,billNo+'.pdf',bytes.length,bytes]);
    billCreated=true;
   }
  }
  await client.query('UPDATE marketplace_conversations SET last_message_at=now(),updated_at=now() WHERE id=$1',[o.conversation_id]);
  await client.query('COMMIT');return NextResponse.json({ok:true,status,billCreated,message:billCreated?'Order updated and itemized bill automatically posted in customer chat.':'Order updated. Any unavailable-item messages have been sent in chat.'});
 }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('update shop order',e);return NextResponse.json({error:'Could not update this order.'},{status:503});}finally{client.release();}
}
