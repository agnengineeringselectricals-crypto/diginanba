import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime='nodejs';
const schema=z.object({organizationId:z.string().uuid()});

export async function POST(request:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Sign in to accept this invitation.'},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Invalid organization invitation.'},{status:400});
  const organizationId=parsed.data.organizationId;
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    const invitation=await client.query(
      `SELECT m.organization_id,o.name,m.status
       FROM organization_memberships m JOIN organization_accounts o ON o.id=m.organization_id
       WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='invited' AND o.status='active'
       FOR UPDATE OF m`,[organizationId,session.user.id]);
    if(!invitation.rows[0]){
      await client.query('ROLLBACK');
      return NextResponse.json({error:'No pending invitation was found for this account.'},{status:404});
    }
    await client.query(
      `UPDATE organization_memberships SET status='active',updated_at=now()
       WHERE organization_id=$1 AND user_id=$2 AND status='invited'`,
      [organizationId,session.user.id]);
    await client.query(
      `UPDATE pm_memberships SET status='active',joined_at=COALESCE(joined_at,now()),updated_at=now()
       WHERE organization_id=$1 AND user_id=$2 AND status='invited'`,
      [organizationId,session.user.id]);
    await client.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,'team.invitation_accepted','organization_member',$2,$3::jsonb)`,
      [organizationId,session.user.id,JSON.stringify({organizationName:invitation.rows[0].name})]);
    await client.query('COMMIT');
    return NextResponse.json({message:'Invitation accepted. You can now access your organization workspace.'});
  }catch(error){
    await client.query('ROLLBACK').catch(()=>undefined);
    console.error('Project Management invitation acceptance failed',error);
    return NextResponse.json({error:'Could not accept this invitation. Please retry.'},{status:503});
  }finally{client.release();}
}
