import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime='nodejs';
const inviteSchema=z.object({organizationId:z.string().uuid(),email:z.string().trim().email().max(254),roleId:z.string().uuid().optional(),roleCode:z.enum(['project_manager','engineer','viewer']).default('engineer'),departmentId:z.string().uuid().nullable().optional()});

async function ensureDefaultRoles(client:any,organizationId:string){
  const roles=[
    ['project_manager','Project Manager','Manage assigned projects, tasks and operational records'],
    ['engineer','Engineer','Execute assigned tasks and record progress and measurements'],
    ['viewer','Read-only Viewer','View permitted project information'],
  ];
  for(const [code,name,description] of roles){
    await client.query(
      `INSERT INTO pm_roles(organization_id,code,name,description,is_system_role)
       VALUES($1,$2,$3,$4,true) ON CONFLICT(organization_id,code) DO NOTHING`,
      [organizationId,code,name,description]);
  }
  const mappings:any={
    project_manager:{'projects.read':[true,false,false,false,false],'projects.create':[true,true,false,false,false],'projects.update':[true,false,true,false,false],'projects.approve':[true,false,false,true,false],'tasks.read':[true,false,false,false,false],'tasks.create':[true,true,false,false,false],'tasks.update':[true,false,true,false,false],'tasks.assign':[true,false,true,false,false],'tasks.approve':[true,false,false,true,false],'performance.read':[true,false,false,false,false],'performance.update':[true,false,true,false,false],'finance.read':[true,false,false,false,false],'procurement.read':[true,false,false,false,false],'procurement.create':[true,true,false,false,false],'documents.read':[true,false,false,false,false]},
    engineer:{'projects.read':[true,false,false,false,false],'tasks.read':[true,false,false,false,false],'tasks.create':[true,true,false,false,false],'tasks.update':[true,false,true,false,false],'performance.read':[true,false,false,false,false],'performance.update':[true,false,true,false,false],'documents.read':[true,false,false,false,false]},
    viewer:{'projects.read':[true,false,false,false,false],'tasks.read':[true,false,false,false,false],'performance.read':[true,false,false,false,false],'documents.read':[true,false,false,false,false]},
  };
  for(const [code,permissions] of Object.entries(mappings)){
    const role=await client.query('SELECT id FROM pm_roles WHERE organization_id=$1 AND code=$2',[organizationId,code]);
    for(const [permission,flags] of Object.entries(permissions as Record<string,boolean[]>)){
      await client.query(
        `INSERT INTO pm_role_permissions(organization_id,role_id,permission_id,access_scope,can_view,can_create,can_update,can_approve,can_delete)
         SELECT $1,$2,id,'project',$4,$5,$6,$7,$8 FROM pm_permissions WHERE code=$3
         ON CONFLICT(role_id,permission_id) DO NOTHING`,
        [organizationId,role.rows[0].id,permission,...flags]);
    }
  }
}

export async function GET(request:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Sign in to manage the organization team.'},{status:401});
  const orgId=new URL(request.url).searchParams.get('organizationId')||'';
  if(!z.string().uuid().safeParse(orgId).success)return NextResponse.json({error:'Choose an organization.'},{status:400});
  try{
    const access=await db.query(
      `SELECT role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='active' LIMIT 1`,
      [orgId,session.user.id]);
    if(!access.rows[0]||!['owner','admin'].includes(access.rows[0].role))return NextResponse.json({error:'Only organization owners and admins can manage the team.'},{status:403});
    const setup=await db.connect();
    try{await setup.query('BEGIN');await ensureDefaultRoles(setup,orgId);await setup.query('COMMIT');}
    catch(error){await setup.query('ROLLBACK').catch(()=>undefined);throw error;}
    finally{setup.release();}
    const [members,departments,roles]=await Promise.all([
      db.query(
        `SELECT pm.id AS membership_id,pm.status,pm.employee_code,pm.employment_type,pm.joined_at,pm.department_id,pm.designation_id,pm.reports_to_membership_id,pm.role_id,
                u.id AS user_id,u.display_name,u.email,r.code AS role_code,r.name AS role_name,
                d.name AS department_name,ds.name AS designation_name,COALESCE(manager_u.display_name,manager_u.email) AS reports_to_name
         FROM pm_memberships pm JOIN users u ON u.id=pm.user_id
         LEFT JOIN pm_roles r ON r.id=pm.role_id AND r.organization_id=pm.organization_id
         LEFT JOIN pm_departments d ON d.id=pm.department_id AND d.organization_id=pm.organization_id
         LEFT JOIN pm_designations ds ON ds.id=pm.designation_id AND ds.organization_id=pm.organization_id
         LEFT JOIN pm_memberships manager ON manager.id=pm.reports_to_membership_id AND manager.organization_id=pm.organization_id
         LEFT JOIN users manager_u ON manager_u.id=manager.user_id
         WHERE pm.organization_id=$1 ORDER BY CASE pm.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,COALESCE(u.display_name,u.email)`,
        [orgId]),
      db.query("SELECT id,name FROM pm_departments WHERE organization_id=$1 AND status='active' ORDER BY name",[orgId]),
      db.query("SELECT id,code,name,description,is_system_role FROM pm_roles WHERE organization_id=$1 AND status='active' ORDER BY name",[orgId]),
    ]);
    return NextResponse.json({members:members.rows,departments:departments.rows,roles:roles.rows});
  }catch(error){console.error('Project Management team lookup failed',error);return NextResponse.json({error:'Team information is temporarily unavailable.'},{status:503});}
}

export async function POST(request:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Sign in to invite a team member.'},{status:401});
  const parsed=inviteSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the invitation details.'},{status:400});
  const input=parsed.data;const email=input.email.toLowerCase();const client=await db.connect();
  try{
    await client.query('BEGIN');
    const access=await client.query(
      `SELECT o.name,m.role FROM organization_accounts o
       JOIN organization_memberships m ON m.organization_id=o.id
       WHERE o.id=$1 AND m.user_id=$2 AND m.status='active' AND o.status='active'
       FOR UPDATE OF o`,[input.organizationId,session.user.id]);
    if(!access.rows[0]||!['owner','admin'].includes(access.rows[0].role)){
      await client.query('ROLLBACK');return NextResponse.json({error:'Only organization owners and admins can invite team members.'},{status:403});
    }
    const user=await client.query('SELECT id,email FROM users WHERE lower(email)=$1 AND status=\'active\' LIMIT 1',[email]);
    if(!user.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'This engineer must create a DigiNanba account with this email first. Then send the invitation again.'},{status:404});}
    await ensureDefaultRoles(client,input.organizationId);
    const existing=await client.query('SELECT status FROM organization_memberships WHERE organization_id=$1 AND user_id=$2',[input.organizationId,user.rows[0].id]);
    if(existing.rows[0]?.status==='active'){await client.query('ROLLBACK');return NextResponse.json({error:'This person is already an active organization member.'},{status:409});}
    await client.query(
      `INSERT INTO organization_memberships(organization_id,user_id,role,status,invited_by)
       VALUES($1,$2,'member','invited',$3)
       ON CONFLICT(organization_id,user_id) DO UPDATE SET role='member',status='invited',invited_by=$3,updated_at=now()`,
      [input.organizationId,user.rows[0].id,session.user.id]);
    const role= input.roleId ? await client.query('SELECT id,code FROM pm_roles WHERE organization_id=$1 AND id=$2 AND status=\'active\'',[input.organizationId,input.roleId]) : await client.query('SELECT id,code FROM pm_roles WHERE organization_id=$1 AND code=$2',[input.organizationId,input.roleCode]);
    if(!role.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Select an active role for this employee.'},{status:400});}
    if(input.departmentId){const department=await client.query("SELECT id FROM pm_departments WHERE id=$1 AND organization_id=$2 AND status='active'",[input.departmentId,input.organizationId]);if(!department.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Select an active department.'},{status:400});}}
    await client.query(
      `INSERT INTO pm_memberships(organization_id,user_id,department_id,role_id,status,employment_type)
       VALUES($1,$2,$3,$4,'invited','employee')
       ON CONFLICT(organization_id,user_id) DO UPDATE SET department_id=EXCLUDED.department_id,role_id=EXCLUDED.role_id,status='invited',updated_at=now()`,
      [input.organizationId,user.rows[0].id,input.departmentId||null,role.rows[0].id]);
    await client.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,'team.member_invited','organization_member',$3,$4::jsonb)`,
      [input.organizationId,session.user.id,user.rows[0].id,JSON.stringify({email,roleCode:role.rows[0].code})]);
    await client.query('COMMIT');

    let emailSent=false;
    const from=process.env.EMAIL_FROM||process.env.PASSWORD_RESET_FROM_EMAIL;const key=process.env.RESEND_API_KEY;
    if(from&&key){
      try{
        const base=(process.env.AUTH_URL||process.env.NEXTAUTH_URL||'https://www.diginanba.com').replace(/\/$/,'');
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:'You are invited to join '+access.rows[0].name+' on DigiNanba',text:'You have been invited to join '+access.rows[0].name+' as '+role.rows[0].code.replaceAll('_',' ')+'. Sign in to DigiNanba with this email address and open Project Management → Team to accept the invitation: '+base+'/project-management/team?accept='+encodeURIComponent(input.organizationId)})});
        emailSent=response.ok;
        if(!response.ok)console.error('Project Management invitation email was not accepted by provider',response.status);
      }catch(error){console.error('Project Management invitation email failed',error);}
    }
    return NextResponse.json({message:emailSent?'Invitation created and email sent.':'Invitation created. Email delivery is not configured; ask the engineer to sign in and accept it from the Team page.',emailSent},{status:201});
  }catch(error){
    await client.query('ROLLBACK').catch(()=>undefined);
    console.error('Project Management team invitation failed',error);
    return NextResponse.json({error:'Could not invite this team member. No changes were saved.'},{status:503});
  }finally{client.release();}
}
