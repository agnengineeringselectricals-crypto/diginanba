import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectPermission } from '@/lib/server/project-permissions';

export const runtime='nodejs';
const uuid=z.string().uuid();

async function accessProject(projectId:string,userId:string){
 const r=await db.query(`SELECT p.organization_id,
   (m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active' AND xm.user_id=$2 AND xm.status='active' )) AS can_manage
   FROM pm_projects p JOIN organization_accounts org_active ON org_active.id=p.organization_id AND org_active.status='active' JOIN organization_memberships m ON m.organization_id=p.organization_id
   WHERE p.id=$1 AND p.status<>'archived' AND m.user_id=$2 AND m.status='active'
    AND (m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active' AND xm.user_id=$2 AND xm.status='active')) LIMIT 1`,[projectId,userId]);
 return r.rows[0] as {organization_id:string;can_manage:boolean}|undefined;
}

export async function GET(_:Request,context:{params:Promise<{projectId:string}>}){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {projectId}=await context.params;if(!uuid.safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
 const access=await accessProject(projectId,session.user.id);if(!access)return NextResponse.json({error:'Project not found or access denied.'},{status:404});
 const permission=await checkProjectPermission(db,projectId,session.user.id,'crm_communications.read','view');if(!permission?.allowed||['assigned','own'].includes(permission.scope||''))return NextResponse.json({error:'Your organization role does not allow viewing external communications at this scope.'},{status:403});
 const [threads,messages]=await Promise.all([
  db.query(`SELECT id,subject,thread_type,status,created_at,updated_at FROM pm_communication_threads WHERE organization_id=$1 AND project_id=$2 AND visibility='external_portal' AND thread_type IN ('client','supplier') ORDER BY updated_at DESC LIMIT 200`,[access.organization_id,projectId]),
  db.query(`SELECT m.id,m.thread_id,m.body,m.created_at,m.sender_user_id,u.display_name AS sender,u.email FROM pm_communication_messages m JOIN pm_communication_threads t ON t.id=m.thread_id AND t.organization_id=m.organization_id LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.organization_id=$1 AND t.project_id=$2 AND t.visibility='external_portal' AND t.thread_type IN ('client','supplier') ORDER BY m.created_at ASC LIMIT 1000`,[access.organization_id,projectId]),
 ]);
 return NextResponse.json({canManage:access.can_manage,threads:threads.rows,messages:messages.rows});
}

export async function POST(request:Request,context:{params:Promise<{projectId:string}>}){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'Sign in required.'},{status:401});
 const {projectId}=await context.params;if(!uuid.safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
 const access=await accessProject(projectId,session.user.id);if(!access)return NextResponse.json({error:'Project not found or access denied.'},{status:404});
 const permission=await checkProjectPermission(db,projectId,session.user.id,'crm_communications.create','create');if(!permission?.allowed||['assigned','own'].includes(permission.scope||''))return NextResponse.json({error:'Your organization role does not allow replying at this scope.'},{status:403});
 const v=z.object({threadId:uuid,body:z.string().trim().min(1).max(5000)}).safeParse(await request.json().catch(()=>null));
 if(!v.success)return NextResponse.json({error:'Enter a message.'},{status:400});
 const thread=await db.query(`SELECT id FROM pm_communication_threads WHERE id=$1 AND organization_id=$2 AND project_id=$3 AND visibility='external_portal' AND thread_type IN ('client','supplier') AND status='open'`,[v.data.threadId,access.organization_id,projectId]);
 if(!thread.rows[0])return NextResponse.json({error:'Conversation not found or closed.'},{status:404});
 const message=(await db.query(`INSERT INTO pm_communication_messages(organization_id,thread_id,sender_user_id,body) VALUES($1,$2,$3,$4) RETURNING id,created_at`,[access.organization_id,v.data.threadId,session.user.id,v.data.body])).rows[0];
 await db.query(`UPDATE pm_communication_threads SET updated_at=now() WHERE id=$1 AND organization_id=$2`,[v.data.threadId,access.organization_id]);
 return NextResponse.json({message},{status:201});
}
