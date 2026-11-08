import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
export const runtime='nodejs';
const schema=z.object({body:z.string().trim().min(1).max(5000)});
async function participant(conversationId:string,userId:string){
 const r=await db.query("SELECT id FROM marketplace_conversations WHERE id=$1 AND (owner_user_id=$2 OR customer_user_id=$2) AND status='open'",[conversationId,userId]);
 return Boolean(r.rowCount);
}
export async function GET(_req:Request,{params}:{params:Promise<{conversationId:string}>}){
 const session=await auth();const userId=session?.user?.id;if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {conversationId}=await params;
 try{
  if(!await participant(conversationId,userId))return NextResponse.json({error:'Conversation not found.'},{status:404});
  const r=await db.query(`SELECT m.id,m.sender_user_id AS "senderUserId",m.message_type AS "messageType",m.body,m.metadata,m.created_at AS "createdAt",
    COALESCE((SELECT json_agg(json_build_object('id',a.id,'name',a.original_file_name,'contentType',a.content_type,'size',a.size_bytes,'purpose',a.purpose)) FROM marketplace_chat_attachments a WHERE a.message_id=m.id),'[]'::json) AS attachments
    FROM marketplace_chat_messages m WHERE m.conversation_id=$1 ORDER BY m.created_at ASC LIMIT 500`,[conversationId]);
  return NextResponse.json({messages:r.rows});
 }catch(e){console.error('load messages',e);return NextResponse.json({error:'Could not load messages.'},{status:503});}
}
export async function POST(req:Request,{params}:{params:Promise<{conversationId:string}>}){
 const session=await auth();const userId=session?.user?.id;if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {conversationId}=await params;const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Message must contain 1–5000 characters.'},{status:400});
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const c=await client.query("SELECT id FROM marketplace_conversations WHERE id=$1 AND (owner_user_id=$2 OR customer_user_id=$2) AND status='open' FOR UPDATE",[conversationId,userId]);
  if(!c.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'Conversation not found.'},{status:404});}
  const m=await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type,body) VALUES($1,$2,'text',$3) RETURNING id,created_at",[conversationId,userId,parsed.data.body]);
  await client.query('UPDATE marketplace_conversations SET last_message_at=now(),updated_at=now() WHERE id=$1',[conversationId]);
  await client.query('COMMIT');return NextResponse.json({message:{id:m.rows[0].id,body:parsed.data.body,createdAt:m.rows[0].created_at,senderUserId:userId,messageType:'text'}},{status:201});
 }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('send message',e);return NextResponse.json({error:'Could not send message.'},{status:503});}finally{client.release();}
}
