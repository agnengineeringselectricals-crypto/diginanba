import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime='nodejs';

export async function POST(request:Request) {
 const session=await auth();
 if(!session?.user?.id||!session.user.email) return NextResponse.json({error:'Sign in with the invited email address before accepting this invitation.'},{status:401});
 const body=await request.json().catch(()=>null);
 const token=typeof body?.token==='string'?body.token:'';
 if(token.length<32||token.length>256) return NextResponse.json({error:'Invitation link is invalid or incomplete.'},{status:400});
 const hash=createHash('sha256').update(token).digest('hex');
 const result=await db.query(`UPDATE pm_external_portal_members SET user_id=$1,status='active',invitation_token_hash=NULL,invitation_expires_at=NULL,last_login_at=now(),updated_at=now()
   WHERE invitation_token_hash=$2 AND lower(email)=lower($3) AND status='invited' AND invitation_expires_at>now()
   RETURNING party_type,contact_name,email`,[session.user.id,hash,session.user.email]);
 if(!result.rows[0]) return NextResponse.json({error:'This invitation has expired, was already used, or belongs to a different email address.'},{status:409});
 return NextResponse.json({ok:true,portalType:result.rows[0].party_type});
}
