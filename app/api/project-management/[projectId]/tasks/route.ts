import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const taskSchema = z.object({
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(10000).default(''),
  workPackageId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  unit: z.string().trim().max(40).optional().nullable(),
  targetQuantity: z.number().nonnegative().optional().nullable(),
  plannedStartDate: z.string().date().optional().nullable(),
  plannedEndDate: z.string().date().optional().nullable(),
  priority: z.enum(['low','normal','high','critical']).default('normal'),
  ownerMembershipId: z.string().uuid().optional().nullable(),
}).refine(v => !v.plannedStartDate || !v.plannedEndDate || v.plannedEndDate >= v.plannedStartDate, {
  message: 'Planned finish must be on or after planned start.',
  path: ['plannedEndDate'],
});

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to view project tasks.' }, { status: 401 });
  const { projectId } = await context.params;
  if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });
  try {
    const access = await db.query(
      `SELECT p.id,p.organization_id FROM pm_projects p
       JOIN organization_memberships m ON m.organization_id=p.organization_id
       WHERE p.id=$1 AND m.user_id=$2 AND m.status='active' AND p.status <> 'archived'
       LIMIT 1`, [projectId, session.user.id]);
    if (!access.rows[0]) return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
    const tasks = await db.query(
      `SELECT t.id,t.task_code,t.title,t.description,t.unit,t.target_quantity,t.actual_quantity,
              t.planned_start_date,t.planned_end_date,t.actual_start_date,t.actual_end_date,t.forecast_end_date,
              t.priority,t.status,t.progress_percent,t.owner_membership_id,
              u.display_name AS owner_name
       FROM pm_tasks t
       LEFT JOIN pm_memberships pm ON pm.id=t.owner_membership_id AND pm.organization_id=t.organization_id
       LEFT JOIN users u ON u.id=pm.user_id
       WHERE t.organization_id=$1 AND t.project_id=$2
       ORDER BY t.created_at,t.title LIMIT 1000`,
      [access.rows[0].organization_id, projectId]);
    return NextResponse.json({ tasks: tasks.rows });
  } catch (error) {
    console.error('Project task list failed', error);
    return NextResponse.json({ error: 'Tasks are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to add project tasks.' }, { status: 401 });
  const { projectId } = await context.params;
  if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });
  const parsed = taskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the task details.' }, { status: 400 });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const access = await client.query(
      `SELECT p.organization_id FROM pm_projects p
       JOIN organization_memberships m ON m.organization_id=p.organization_id
       WHERE p.id=$1 AND m.user_id=$2 AND m.status='active' AND p.status <> 'archived'
       LIMIT 1 FOR UPDATE OF p`, [projectId, session.user.id]);
    if (!access.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
    }
    const orgId = access.rows[0].organization_id as string;
    const input = parsed.data;
    if (input.workPackageId) {
      const valid = await client.query('SELECT 1 FROM pm_work_packages WHERE id=$1 AND organization_id=$2 AND project_id=$3', [input.workPackageId, orgId, projectId]);
      if (!valid.rows[0]) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Work package does not belong to this project.' }, { status: 400 }); }
    }
    if (input.parentTaskId) {
      const valid = await client.query('SELECT 1 FROM pm_tasks WHERE id=$1 AND organization_id=$2 AND project_id=$3', [input.parentTaskId, orgId, projectId]);
      if (!valid.rows[0]) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Parent task does not belong to this project.' }, { status: 400 }); }
    }
    if (input.ownerMembershipId) {
      const valid = await client.query("SELECT 1 FROM pm_memberships WHERE id=$1 AND organization_id=$2 AND status='active'", [input.ownerMembershipId, orgId]);
      if (!valid.rows[0]) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Task owner is not an active member of this organization.' }, { status: 400 }); }
    }
    const created = await client.query(
      `INSERT INTO pm_tasks(organization_id,project_id,work_package_id,parent_task_id,title,description,unit,target_quantity,
        planned_start_date,planned_end_date,priority,owner_membership_id,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id,title,status,actual_quantity,target_quantity,planned_start_date,planned_end_date,priority`,
      [orgId,projectId,input.workPackageId||null,input.parentTaskId||null,input.title,input.description,input.unit||null,
       input.targetQuantity??null,input.plannedStartDate||null,input.plannedEndDate||null,input.priority,input.ownerMembershipId||null,session.user.id]);
    await client.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,$3,'task.created','task',$4,$5::jsonb)`,
      [orgId,session.user.id,projectId,created.rows[0].id,JSON.stringify({title:input.title})]);
    await client.query('COMMIT');
    return NextResponse.json({ task: created.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Project task creation failed', error);
    return NextResponse.json({ error: 'Could not create the task. No changes were saved.' }, { status: 503 });
  } finally { client.release(); }
}
