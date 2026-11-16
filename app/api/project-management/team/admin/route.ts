import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { checkOrganizationPermission } from '@/lib/server/project-permissions';

export const runtime='nodejs';
const uuid=z.string().uuid();
const permissionSchema=z.object({code:z.string().min(3).max(100),scope:z.enum(['organization','department','project','assigned','own']).default('assigned'),view:z.boolean().default(false),create:z.boolean().default(false),update:z.boolean().default(false),approve:z.boolean().default(false),delete:z.boolean().default(false)});
const createSchema=z.discriminatedUnion('type',[
 z.object({organizationId:uuid,type:z.literal('department'),name:z.string().trim().min(2).max(120),code:z.string().trim().max(30).optional().default(''),description:z.string().max(1000).optional().default(''),parentId:uuid.nullable().optional()}),
 z.object({organizationId:uuid,type:z.literal('designation'),name:z.string().trim().min(2).max(120),description:z.string().max(1000).optional().default(''),level:z.number().int().min(0).max(100).default(0)}),
 z.object({organizationId:uuid,type:z.literal('role'),name:z.string().trim().min(2).max(100),description:z.string().max(1000).optional().default(''),permissions:z.array(permissionSchema).max(100).default([])})
]);
const patchSchema=z.discriminatedUnion('type',[
 z.object({organizationId:uuid,type:z.literal('member'),membershipId:uuid,departmentId:uuid.nullable(),designationId:uuid.nullable(),reportsToMembershipId:uuid.nullable(),roleId:uuid.nullable(),employeeCode:z.string().trim().max(40).nullable(),employmentType:z.enum(['employee','contractor','consultant','intern','temporary']).default('employee'),status:z.enum(['active','suspended','inactive','removed'])}),
 z.object({organizationId:uuid,type:z.literal('department'),id:uuid,name:z.string().trim().min(2).max(120),code:z.string().trim().max(30).nullable(),description:z.string().max(1000),parentId:uuid.nullable(),status:z.enum(['active','inactive','archived'])}),
 z.object({organizationId:uuid,type:z.literal('designation'),id:uuid,name:z.string().trim().min(2).max(120),description:z.string().max(1000),level:z.number().int().min(0).max(100),status:z.enum(['active','inactive'])}),
 z.object({organizationId:uuid,type:z.literal('role'),id:uuid,name:z.string().trim().min(2).max(100),description:z.string().max(1000),status:z.enum(['active','inactive']),permissions:z.array(permissionSchema).max(100)})
]);

async function organizationAdmin(userId:string,organizationId:string,client:any,code='organization.manage',action:'create'|'update'='update'){
 return checkOrganizationPermission(client,organizationId,userId,code,action);
}
async function savePermissions(client:any,organizationId:string,roleId:string,permissions:z.infer<typeof permissionSchema>[]){
 await client.query('DELETE FROM pm_role_permissions WHERE organization_id=$1 AND role_id=$2',[organizationId,roleId]);
 for(const p of permissions){
  await client.query(`INSERT INTO pm_role_permissions(organization_id,role_id,permission_id,access_scope,can_view,can_create,can_update,can_approve,can_delete)
   SELECT $1,$2,id,$4,$5,$6,$7,$8,$9 FROM pm_permissions WHERE code=$3
   ON CONFLICT(role_id,permission_id) DO UPDATE SET access_scope=EXCLUDED.access_scope,can_view=EXCLUDED.can_view,can_create=EXCLUDED.can_create,can_update=EXCLUDED.can_update,can_approve=EXCLUDED.can_approve,can_delete=EXCLUDED.can_delete`,
   [organizationId,roleId,p.code,p.scope,p.view,p.create,p.update,p.approve,p.delete]);
 }
}

export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'Sign in to manage organization people.'},{status:401});
 const orgId=new URL(request.url).searchParams.get('organizationId')||'';if(!uuid.safeParse(orgId).success)return NextResponse.json({error:'Choose an organization.'},{status:400});
 try{
  const allowed=await checkOrganizationPermission(db,orgId,session.user.id,'organization.manage','view')||await checkOrganizationPermission(db,orgId,session.user.id,'roles.manage','view');
  if(!allowed)return NextResponse.json({error:'Your organization role does not allow managing departments, employees or roles.'},{status:403});
  const [departments,designations,roles,permissions]=await Promise.all([
   db.query(`SELECT d.id,d.code,d.name,d.description,d.parent_department_id,d.status,d.sort_order,COUNT(m.id)::int AS employee_count
    FROM pm_departments d LEFT JOIN pm_memberships m ON m.organization_id=d.organization_id AND m.department_id=d.id AND m.status='active'
    WHERE d.organization_id=$1 GROUP BY d.id ORDER BY d.sort_order,d.name`,[orgId]),
   db.query(`SELECT id,name,description,level,status FROM pm_designations WHERE organization_id=$1 ORDER BY level DESC,name`,[orgId]),
   db.query(`SELECT r.id,r.code,r.name,r.description,r.is_system_role,r.status,COUNT(m.id)::int AS member_count
    FROM pm_roles r LEFT JOIN pm_memberships m ON m.organization_id=r.organization_id AND m.role_id=r.id AND m.status='active'
    WHERE r.organization_id=$1 GROUP BY r.id ORDER BY r.is_system_role DESC,r.name`,[orgId]),
   db.query(`SELECT p.code,p.module_code,p.description FROM pm_permissions p ORDER BY p.module_code,p.code`)
  ]);
  const rolePermissions=await db.query(`SELECT rp.role_id,p.code,rp.access_scope,rp.can_view,rp.can_create,rp.can_update,rp.can_approve,rp.can_delete
   FROM pm_role_permissions rp JOIN pm_permissions p ON p.id=rp.permission_id JOIN pm_roles r ON r.id=rp.role_id
   WHERE rp.organization_id=$1 AND r.organization_id=$1 ORDER BY p.module_code,p.code`,[orgId]);
  return NextResponse.json({departments:departments.rows,designations:designations.rows,roles:roles.rows,permissions:permissions.rows,rolePermissions:rolePermissions.rows});
 }catch(error){console.error('Organization people admin lookup failed',error);return NextResponse.json({error:'Organization people data is temporarily unavailable.'},{status:503});}
}

export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'Sign in first.'},{status:401});
 const parsed=createSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the details.'},{status:400});
 const input=parsed.data,orgId=input.organizationId,client=await db.connect();
 try{
  await client.query('BEGIN');if(!await organizationAdmin(session.user.id,orgId,client,input.type==='role'?'roles.manage':'organization.manage','create')){await client.query('ROLLBACK');return NextResponse.json({error:'Access denied.'},{status:403});}
  let created:any;
  if(input.type==='department'){
   if(input.parentId){const p=await client.query(`SELECT id FROM pm_departments WHERE id=$1 AND organization_id=$2 AND status='active'`,[input.parentId,orgId]);if(!p.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Choose a valid parent department.'},{status:400});}}
   created=await client.query(`INSERT INTO pm_departments(organization_id,name,code,description,parent_department_id)
    VALUES($1,$2,NULLIF($3,''),$4,$5) RETURNING id,name`,[orgId,input.name,input.code,input.description,input.parentId||null]);
  }else if(input.type==='designation'){
   created=await client.query(`INSERT INTO pm_designations(organization_id,name,description,level) VALUES($1,$2,$3,$4) RETURNING id,name`,[orgId,input.name,input.description,input.level]);
  }else{
   const code='custom_'+randomUUID().replaceAll('-','').slice(0,16);
   created=await client.query(`INSERT INTO pm_roles(organization_id,code,name,description,is_system_role) VALUES($1,$2,$3,$4,false) RETURNING id,name,code`,[orgId,code,input.name,input.description]);
   await savePermissions(client,orgId,created.rows[0].id,input.permissions);
  }
  await client.query(`INSERT INTO pm_audit_events(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
   VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[orgId,session.user.id,'organization.'+input.type+'_created',input.type,created.rows[0].id,JSON.stringify(input)]);
  await client.query('COMMIT');return NextResponse.json({item:created.rows[0],message:input.type+' created.'},{status:201});
 }catch(error){await client.query('ROLLBACK').catch(()=>undefined);console.error('Organization structure create failed',error);return NextResponse.json({error:'Could not save this item. Check for a duplicate name or code.'},{status:409});}
 finally{client.release();}
}

export async function PATCH(request:Request){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:'Sign in first.'},{status:401});
 const parsed=patchSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the update.'},{status:400});
 const input=parsed.data,orgId=input.organizationId,client=await db.connect();
 try{
  await client.query('BEGIN');if(!await organizationAdmin(session.user.id,orgId,client,input.type==='role'?'roles.manage':'organization.manage','update')){await client.query('ROLLBACK');return NextResponse.json({error:'Access denied.'},{status:403});}
  if(input.type==='member'){
   const current=await client.query(`SELECT id,user_id FROM pm_memberships WHERE id=$1 AND organization_id=$2 FOR UPDATE`,[input.membershipId,orgId]);
   if(!current.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Employee not found.'},{status:404});}
   if(input.reportsToMembershipId===input.membershipId){await client.query('ROLLBACK');return NextResponse.json({error:'An employee cannot report to themselves.'},{status:400});}
   if(input.reportsToMembershipId){
    const manager=await client.query(`SELECT id FROM pm_memberships WHERE id=$1 AND organization_id=$2 AND status='active'`,[input.reportsToMembershipId,orgId]);
    if(!manager.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Reporting manager must be an active organization employee.'},{status:400});}
    const cycle=await client.query(`WITH RECURSIVE chain(id,reports_to_membership_id) AS (
      SELECT id,reports_to_membership_id FROM pm_memberships WHERE id=$1 AND organization_id=$2
      UNION SELECT m.id,m.reports_to_membership_id FROM pm_memberships m JOIN chain c ON m.id=c.reports_to_membership_id WHERE m.organization_id=$2
     ) SELECT 1 FROM chain WHERE id=$3 LIMIT 1`,[input.reportsToMembershipId,orgId,input.membershipId]);
    if(cycle.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'This reporting change would create a management cycle.'},{status:400});}
   }
   await client.query(`UPDATE pm_memberships SET department_id=$3,designation_id=$4,reports_to_membership_id=$5,role_id=$6,employee_code=NULLIF($7,''),employment_type=$8,status=$9,updated_at=now(),joined_at=CASE WHEN $9='active' THEN COALESCE(joined_at,now()) ELSE joined_at END WHERE id=$1 AND organization_id=$2`,
    [input.membershipId,orgId,input.departmentId,input.designationId,input.reportsToMembershipId,input.roleId,input.employeeCode||null,input.employmentType,input.status]);
   const orgStatus=input.status==='removed'?'removed':input.status==='suspended'?'suspended':input.status==='active'?'active':'active';
   await client.query(`UPDATE organization_memberships SET status=$3,updated_at=now() WHERE organization_id=$1 AND user_id=$2`,[orgId,current.rows[0].user_id,orgStatus]);
   await client.query(`INSERT INTO pm_audit_events(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
    VALUES($1,$2,'team.member_updated','organization_member',$3,$4::jsonb)`,[orgId,session.user.id,current.rows[0].user_id,JSON.stringify(input)]);
  }else if(input.type==='department'){
   if(input.parentId===input.id){await client.query('ROLLBACK');return NextResponse.json({error:'A department cannot be its own parent.'},{status:400});}
   if(input.parentId){
    const parent=await client.query(`SELECT id FROM pm_departments WHERE id=$1 AND organization_id=$2 AND status='active'`,[input.parentId,orgId]);
    if(!parent.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Parent department not found.'},{status:404});}
    const cycle=await client.query(`WITH RECURSIVE ancestors(id,parent_department_id) AS (
      SELECT id,parent_department_id FROM pm_departments WHERE id=$1 AND organization_id=$2
      UNION SELECT d.id,d.parent_department_id FROM pm_departments d JOIN ancestors a ON d.id=a.parent_department_id WHERE d.organization_id=$2
     ) SELECT 1 FROM ancestors WHERE id=$3 LIMIT 1`,[input.parentId,orgId,input.id]);
    if(cycle.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'This change would create a department hierarchy cycle.'},{status:400});}
   }
   await client.query(`UPDATE pm_departments SET name=$3,code=$4,description=$5,parent_department_id=$6,status=$7,updated_at=now() WHERE id=$1 AND organization_id=$2`,[input.id,orgId,input.name,input.code,input.description,input.parentId,input.status]);
  }else if(input.type==='designation'){
   await client.query(`UPDATE pm_designations SET name=$3,description=$4,level=$5,status=$6 WHERE id=$1 AND organization_id=$2`,[input.id,orgId,input.name,input.description,input.level,input.status]);
  }else{
   const role=await client.query(`SELECT is_system_role FROM pm_roles WHERE id=$1 AND organization_id=$2 FOR UPDATE`,[input.id,orgId]);if(!role.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Role not found.'},{status:404});}
   if(role.rows[0].is_system_role){await client.query('ROLLBACK');return NextResponse.json({error:'Built-in roles cannot be renamed or deactivated. Create a custom role instead.'},{status:400});}
   await client.query(`UPDATE pm_roles SET name=$3,description=$4,status=$5 WHERE id=$1 AND organization_id=$2`,[input.id,orgId,input.name,input.description,input.status]);
   await savePermissions(client,orgId,input.id,input.permissions);
  }
  if(input.type!=='member'){
   await client.query(`INSERT INTO pm_audit_events(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
    VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[orgId,session.user.id,'organization.'+input.type+'_updated',input.type,input.id,JSON.stringify(input)]);
  }
  await client.query('COMMIT');return NextResponse.json({message:'Changes saved.'});
 }catch(error){await client.query('ROLLBACK').catch(()=>undefined);console.error('Organization people update failed',error);return NextResponse.json({error:'Could not save changes. Check linked employees and duplicate values.'},{status:409});}
 finally{client.release();}
}
