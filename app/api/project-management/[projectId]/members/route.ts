import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime='nodejs';
const schema=z.object({membershipId:z.string().uuid(),projectRole:z.enum(['project_manager','engineer','viewer']).default('engineer'),accessLevel:z.enum(['project_admin','project_read','assigned']).default('assigned')});

export async function GET(_request:Request,context:{params:Promise<{projectId:string}>}){
  const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'Sign in to view project members.'},{status:401});
  const {projectId}=await context.params;if(!z.string().uuid().safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
  try{
    const access=await db.query(
      `SELECT p.organization_id FROM pm_projects p JOIN organization_memberships m ON m.organization_id=p.organization_id
       WHERE p.id=$1 AND m.user_id=$2 AND m.status='active'
       AND (m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active' AND xm.user_id=$2 AND xm.status='active'))
       LIMIT 1`,[projectId,session.user.id]);
    if(!access.rows[0])return NextResponse.json({error:'Project not found or access denied.'},{status:404});
    const members=await db.query(
      `SELECT pm.id AS membership_id,u.display_name,u.email,pm.employee_code,pm.status,r.code AS role_code,r.name AS role_name,
              COALESCE(pmx.access_level,'not_assigned') AS access_level,pmx.project_role
       FROM pm_memberships pm JOIN users u ON u.id=pm.user_id
       LEFT JOIN pm_roles r ON r.id=pm.role_id AND r.organization_id=pm.organization_id
       LEFT JOIN pm_project_members pmx ON pmx.membership_id=pm.id AND pmx.project_id=$2 AND pmx.organization_id=pm.organization_id AND pmx.status='active'
       WHERE pm.organization_id=$1 AND pm.status='active'
         AND (
           EXISTS(SELECT 1 FROM organization_memberships om WHERE om.organization_id=pm.organization_id AND om.user_id=$3 AND om.status='active' AND om.role IN ('owner','admin'))
           OR EXISTS(SELECT 1 FROM pm_project_members adm JOIN pm_memberships admu ON admu.id=adm.membership_id WHERE adm.project_id=$2 AND adm.organization_id=pm.organization_id AND adm.status='active' AND adm.access_level='project_admin' AND admu.user_id=$3 AND admu.status='active')
           OR EXISTS(SELECT 1 FROM pm_project_members mine WHERE mine.project_id=$2 AND mine.organization_id=pm.organization_id AND mine.membership_id=pm.id AND mine.status='active')
         )
       ORDER BY COALESCE(u.display_name,u.email)`,[access.rows[0].organization_id,projectId,session.user.id]);
    return NextResponse.json({members:members.rows});
  }catch(error){console.error('Project member lookup failed',error);return NextResponse.json({error:'Project members are temporarily unavailable.'},{status:503});}
}

export async function POST(request:Request,context:{params:Promise<{projectId:string}>}){
  const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'Sign in to assign project members.'},{status:401});
  const {projectId}=await context.params;if(!z.string().uuid().safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the member assignment.'},{status:400});
  const input=parsed.data;const client=await db.connect();
  try{
    await client.query('BEGIN');
    const access=await client.query(
      `SELECT p.organization_id FROM pm_projects p JOIN organization_memberships m ON m.organization_id=p.organization_id
       WHERE p.id=$1 AND m.user_id=$2 AND m.status='active' AND p.status<>'archived'
       AND (m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active' AND xm.user_id=$2 AND xm.status='active' AND x.access_level='project_admin'))
       LIMIT 1 FOR UPDATE OF p`,[projectId,session.user.id]);
    if(!access.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Only project managers can assign members.'},{status:403});}
    const orgId=access.rows[0].organization_id as string;
    const member=await client.query(`SELECT id FROM pm_memberships WHERE id=$1 AND organization_id=$2 AND status='active'`,[input.membershipId,orgId]);
    if(!member.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Select an active member of this organization.'},{status:400});}
    await client.query(
      `INSERT INTO pm_project_members(organization_id,project_id,membership_id,project_role,access_level,status)
       VALUES($1,$2,$3,$4,$5,'active')
       ON CONFLICT(project_id,membership_id) DO UPDATE SET project_role=EXCLUDED.project_role,access_level=EXCLUDED.access_level,status='active'`,
      [orgId,projectId,input.membershipId,input.projectRole,input.accessLevel]);
    await client.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,$3,'project.member_assigned','project_member',$4,$5::jsonb)`,
      [orgId,session.user.id,projectId,input.membershipId,JSON.stringify({projectRole:input.projectRole,accessLevel:input.accessLevel})]);
    await client.query('COMMIT');return NextResponse.json({message:'Member assigned to project.'},{status:201});
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);console.error('Project member assignment failed',error);return NextResponse.json({error:'Could not assign project member.'},{status:503});}
  finally{client.release();}
}
