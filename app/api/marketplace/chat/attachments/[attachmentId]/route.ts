import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{attachmentId:string}>}){
 const session=await auth();const userId=session?.user?.id;if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {attachmentId}=await params;
 try{
  const r=await db.query(`SELECT a.original_file_name,a.content_type,a.content_bytes,c.owner_user_id,c.customer_user_id
   FROM marketplace_chat_attachments a JOIN marketplace_conversations c ON c.id=a.conversation_id
   WHERE a.id=$1 AND (c.owner_user_id=$2 OR c.customer_user_id=$2)`,[attachmentId,userId]);
  if(!r.rowCount)return NextResponse.json({error:'File not found.'},{status:404});
  const a=r.rows[0];return new Response(a.content_bytes,{headers:{'Content-Type':a.content_type,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(a.original_file_name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('download chat attachment',e);return NextResponse.json({error:'Could not open attachment.'},{status:503});}
}
