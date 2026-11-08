import {NextResponse} from 'next/server';
import {auth} from '@/lib/auth';
import {db} from '@/lib/db';
export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{conversationId:string}>}){
 const s=await auth();const u=s?.user?.id;if(!u)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {conversationId}=await params;
 try{
  const r=await db.query(`SELECT c.id,c.connection_id AS "connectionId",c.owner_user_id AS "ownerUserId",c.customer_user_id AS "customerUserId",
   b.id AS "businessId",b.business_name AS "shopName",b.door_delivery_enabled AS "doorDeliveryEnabled",b.self_collection_enabled AS "selfCollectionEnabled",
   b.default_delivery_fee AS "deliveryFee",b.country_code AS "countryCode"
   FROM marketplace_conversations c JOIN marketplace_customer_accounts a ON a.id=c.workspace_account_id
   JOIN marketplace_businesses b ON b.id=a.workspace_ref WHERE c.id=$1 AND (c.owner_user_id=$2 OR c.customer_user_id=$2)`,[conversationId,u]);
  if(!r.rowCount)return NextResponse.json({error:'Conversation not found.'},{status:404});
  const listings=await db.query(`SELECT id,title,category,price_amount AS price,currency,price_unit AS unit,availability_status AS availability
   FROM marketplace_listings WHERE business_id=$1 AND listing_status='published' ORDER BY title LIMIT 300`,[r.rows[0].businessId]);
  return NextResponse.json({conversation:r.rows[0],isOwner:r.rows[0].ownerUserId===u,listings:listings.rows});
 }catch(e){console.error(e);return NextResponse.json({error:'Could not load conversation.'},{status:503});}
}
