import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectPermission } from '@/lib/server/project-permissions';

export const runtime = 'nodejs';
const schema = z.object({
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).default(''),
  parentPackageId: z.string().uuid().nullable().optional(),
  packageCode: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});

async function getProjectAccess(projectId: string, userId: string, write = false) {
  return db.query(
    `SELECT p.organization_id FROM pm_projects p JOIN organization_accounts org_active ON org_active.id=p.organization_id AND org_active.status='active' JOIN organization_memberships m ON m.organization_id=p.organization_id
     WHERE p.id=$1 AND m.user_id=$2 AND m.status='active' AND p.status <> 'archived'
       AND (m.role IN ('owner','admin') OR EXISTS (
         SELECT 1 FROM pm_project_members pmx
         JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
         WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id
           AND pmx.status='active' AND mmx.user_id=$2 AND mmx.status='active'
           AND ($3::boolean=false OR pmx.access_level='project_admin')
       ))
     LIMIT 1`,
    [projectId,userId,write],
  );
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Sign in to view work packages.'},{status:401});
  const {projectId}=await context.params;
  if(!z.string().uuid().safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
  try{
    const access=await getProjectAccess(projectId,session.user.id,false);
    if(!access.rows[0])return NextResponse.json({error:'Project not found or access denied.'},{status:404});
    const permission=await checkProjectPermission(db,projectId,s.user.id,'tasks.read','view');if(!permission?.allowed)return NextResponse.json({error:'Your organization role does not allow this viewing work packages.'},{status:403});
    const result=await db.query(
      `SELECT id,package_code,name,description,parent_package_id,sort_order,created_at
       FROM pm_work_packages WHERE organization_id=$1 AND project_id=$2
       ORDER BY sort_order,name LIMIT 1000`,
      [access.rows[0].organization_id,projectId]);
    return NextResponse.json({workPackages:result.rows});
  }catch(error){
    console.error('Work package list failed',error);
    return NextResponse.json({error:'Work packages are temporarily unavailable.'},{status:503});
  }
}

export async function POST(request:Request,context:{params:Promise<{projectId:string}>}){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Sign in to create work packages.'},{status:401});
  const {projectId}=await context.params;
  if(!z.string().uuid().safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the work package details.'},{status:400});
  const input=parsed.data;const client=await db.connect();
  try{
    await client.query('BEGIN');
    const access=await client.query(
      `SELECT p.organization_id FROM pm_projects p
       JOIN organization_memberships m ON m.organization_id=p.organization_id
       WHERE p.id=$1 AND m.user_id=$2 AND m.status='active' AND p.status <> 'archived'
         AND (m.role IN ('owner','admin') OR EXISTS (
           SELECT 1 FROM pm_project_members pmx JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
           WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.status='active'
             AND mmx.user_id=$2 AND mmx.status='active' AND pmx.access_level='project_admin'
         ))
       LIMIT 1 FOR UPDATE OF p`,[projectId,session.user.id]);
    if(!access.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Project not found or access denied.'},{status:404});}
    const permission=await checkProjectPermission(client,projectId,session.user.id,'tasks.create','create');if(!permission?.allowed){await client.query('ROLLBACK');return NextResponse.json({error:'Your organization role does not allow creating work packages.'},{status:403});}
    const orgId=access.rows[0].organization_id as string;
    if(input.parentPackageId){
      const parent=await client.query('SELECT 1 FROM pm_work_packages WHERE id=$1 AND organization_id=$2 AND project_id=$3',[input.parentPackageId,orgId,projectId]);
      if(!parent.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Parent work package must belong to this project.'},{status:400});}
    }
    const created=await client.query(
      `INSERT INTO pm_work_packages(organization_id,project_id,parent_package_id,package_code,name,description,sort_order)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,package_code,name,description,parent_package_id,sort_order`,
      [orgId,projectId,input.parentPackageId||null,input.packageCode||null,input.name,input.description,input.sortOrder]);
    await client.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,$3,'work_package.created','work_package',$4,$5::jsonb)`,
      [orgId,session.user.id,projectId,created.rows[0].id,JSON.stringify({name:input.name,packageCode:input.packageCode||null})]);
    await client.query('COMMIT');
    return NextResponse.json({workPackage:created.rows[0]},{status:201});
  }catch(error){
    await client.query('ROLLBACK').catch(()=>undefined);
    console.error('Work package creation failed',error);
    return NextResponse.json({error:'Could not create work package. No changes were saved.'},{status:503});
  }finally{client.release();}
}
