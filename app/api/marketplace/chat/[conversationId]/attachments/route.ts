import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
export const runtime='nodejs';
const allowed=new Set(['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','video/mp4','video/webm']);
export async function POST(req:Request,{params}:{params:Promise<{conversationId:string}>}){
 const session=await auth();const userId=session?.user?.id;if(!userId)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {conversationId}=await params;
 const form=await req.formData().catch(()=>null);const file=form?.get('file');
 if(!(file instanceof File))return NextResponse.json({error:'Choose a file to upload.'},{status:400});
 if(!allowed.has(file.type))return NextResponse.json({error:'Supported files: JPG, PNG, WEBP, PDF, DOCX, TXT, MP4 and WEBM.'},{status:415});
 if(file.size<1||file.size>4*1024*1024)return NextResponse.json({error:'Each attachment must be 4 MB or smaller.'},{status:413});
 const bytes=Buffer.from(await file.arrayBuffer());
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const c=await client.query("SELECT id FROM marketplace_conversations WHERE id=$1 AND (owner_user_id=$2 OR customer_user_id=$2) AND status='open' FOR UPDATE",[conversationId,userId]);
  if(!c.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'Conversation not found.'},{status:404});}
  const msg=await client.query("INSERT INTO marketplace_chat_messages(conversation_id,sender_user_id,message_type) VALUES($1,$2,'attachment') RETURNING id",[conversationId,userId]);
  const purpose=form?.get('purpose')==='handwritten_list'?'handwritten_list':'chat';
  const a=await client.query(`INSERT INTO marketplace_chat_attachments(message_id,conversation_id,uploaded_by,original_file_name,content_type,size_bytes,content_bytes,purpose)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,original_file_name,content_type,size_bytes,purpose`,
    [msg.rows[0].id,conversationId,userId,file.name.slice(0,255),file.type,file.size,bytes,purpose]);
  await client.query('UPDATE marketplace_conversations SET last_message_at=now(),updated_at=now() WHERE id=$1',[conversationId]);
  await client.query('COMMIT');return NextResponse.json({attachment:a.rows[0],messageId:msg.rows[0].id},{status:201});
 }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('upload chat attachment',e);return NextResponse.json({error:'Upload failed. Please retry.'},{status:503});}finally{client.release();}
}
