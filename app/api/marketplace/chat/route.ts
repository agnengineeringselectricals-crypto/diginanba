import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
export const runtime='nodejs';
const schema=z.object({connectionId:z.string().uuid()});
export async function GET(){
 const session=await auth(); const userId=session?.user?.id;
 if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 try{
  const r=await db.query(`SELECT c.id,c.status,c.last_message_at AS "lastMessageAt",
    CASE WHEN c.customer_user_id=$1 THEN b.business_name ELSE COALESCE(u.display_name,u.email,'Customer') END AS "otherName",
    CASE WHEN c.customer_user_id=$1 THEN b.public_id ELSE NULL END AS "shopPublicId",
    (SELECT body FROM marketplace_chat_messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage"
   FROM marketplace_conversations c
   JOIN marketplace_customer_accounts a ON a.id=c.workspace_account_id
   LEFT JOIN marketplace_businesses b ON b.id=a.workspace_ref
   LEFT JOIN users u ON u.id=c.customer_user_id
   WHERE (c.customer_user_id=$1 OR c.owner_user_id=$1) AND c.status<>'blocked'
   ORDER BY c.last_message_at DESC NULLS LAST,c.created_at DESC LIMIT 100`,[userId]);
  return NextResponse.json({conversations:r.rows});
 }catch(e){console.error('chat list',e);return NextResponse.json({error:'Could not load conversations.'},{status:503});}
}
export async function POST(req:Request){
 const session=await auth();const userId=session?.user?.id;
 if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Choose a connected shop.'},{status:400});
 try{
  const r=await db.query(`SELECT id,workspace_account_id,owner_user_id,customer_user_id FROM marketplace_customer_workspace_connections
   WHERE id=$1 AND status='connected' AND (owner_user_id=$2 OR customer_user_id=$2)`,[parsed.data.connectionId,userId]);
  if(!r.rowCount)return NextResponse.json({error:'This customer/shop connection is unavailable.'},{status:404});
  const c=r.rows[0];
  const created=await db.query(`INSERT INTO marketplace_conversations(connection_id,workspace_account_id,owner_user_id,customer_user_id)
   VALUES($1,$2,$3,$4) ON CONFLICT(connection_id) DO UPDATE SET updated_at=now()
   RETURNING id`,[c.id,c.workspace_account_id,c.owner_user_id,c.customer_user_id]);
  return NextResponse.json({conversationId:created.rows[0].id});
 }catch(e){console.error('create conversation',e);return NextResponse.json({error:'Could not open chat.'},{status:503});}
}
