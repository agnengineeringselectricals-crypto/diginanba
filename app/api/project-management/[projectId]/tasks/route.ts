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
         AND (m.role IN ('owner','admin') OR EXISTS (
           SELECT 1 FROM pm_project_members pmx JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
           WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.status='active' AND mmx.user_id=$2 AND mmx.status='active'
         ))
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
         AND (m.role IN ('owner','admin') OR EXISTS (
           SELECT 1 FROM pm_project_members pmx JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
           WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.status='active' AND mmx.user_id=$2 AND mmx.status='active' AND pmx.access_level='project_admin'
         ))
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
    const metric = await client.query(
      `INSERT INTO pm_performance_metrics(
         organization_id,project_id,entity_type,entity_id,metric_code,metric_name,unit,
         baseline_target,current_target,actual_value,current_status,
         planned_start_date,planned_finish_date,responsible_membership_id,updated_by
       ) VALUES($1,$2,'task',$3,'quantity','Task quantity',$4,$5,$5,0,'not_started',$6,$7,$8,$9)
       RETURNING id`,
      [orgId,projectId,created.rows[0].id,input.unit||null,input.targetQuantity??null,
       input.plannedStartDate||null,input.plannedEndDate||null,input.ownerMembershipId||null,session.user.id]);
    await client.query(
      `INSERT INTO pm_performance_measurements(organization_id,metric_id,target_value,actual_value,status,note,measured_by)
       VALUES($1,$2,$3,0,'not_started','Initial task baseline',$4)`,
      [orgId,metric.rows[0].id,input.targetQuantity??null,session.user.id]);
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

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to update project tasks.' }, { status: 401 });
  const { projectId } = await context.params;
  if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });
  const schema = z.object({
    taskId: z.string().uuid(),
    status: z.enum(['not_started','in_progress','blocked','on_hold','completed','cancelled']).optional(),
    actualQuantity: z.number().nonnegative().optional(),
    targetQuantity: z.number().nonnegative().nullable().optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    actualStartDate: z.string().date().nullable().optional(),
    actualEndDate: z.string().date().nullable().optional(),
    forecastEndDate: z.string().date().nullable().optional(),
    deviationReason: z.string().trim().max(4000).optional(),
    correctiveAction: z.string().trim().max(4000).optional(),
    nextFollowUpAt: z.string().datetime().nullable().optional(),
  }).refine(v => Object.keys(v).some(k => k !== 'taskId'), { message: 'Provide at least one field to update.' });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check task update.' }, { status: 400 });
  const input = parsed.data;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const access = await client.query(
      `SELECT p.organization_id,m.role,
              (m.role IN ('owner','admin') OR EXISTS (
                SELECT 1 FROM pm_project_members pmx JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
                WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.status='active'
                  AND mmx.user_id=$2 AND mmx.status='active' AND pmx.access_level='project_admin'
              )) AS can_manage,
              (SELECT id FROM pm_memberships WHERE organization_id=p.organization_id AND user_id=$2 AND status='active' LIMIT 1) AS actor_membership_id
       FROM pm_projects p JOIN organization_memberships m ON m.organization_id=p.organization_id
       WHERE p.id=$1 AND m.user_id=$2 AND m.status='active' AND p.status <> 'archived'
         AND (m.role IN ('owner','admin') OR EXISTS (
           SELECT 1 FROM pm_project_members pmx JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
           WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.status='active'
             AND mmx.user_id=$2 AND mmx.status='active'
         ))
       LIMIT 1 FOR UPDATE OF p`, [projectId, session.user.id]);
    if (!access.rows[0]) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 }); }
    const orgId = access.rows[0].organization_id as string;
    const before = await client.query(
      'SELECT id,status,actual_quantity,target_quantity,progress_percent,actual_start_date,actual_end_date,forecast_end_date,owner_membership_id FROM pm_tasks WHERE id=$1 AND organization_id=$2 AND project_id=$3 FOR UPDATE',
      [input.taskId, orgId, projectId]);
    if (!before.rows[0]) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Task not found.' }, { status: 404 }); }
    const old = before.rows[0];
    const isAssignedOwner = Boolean(access.rows[0].actor_membership_id && old.owner_membership_id === access.rows[0].actor_membership_id);
    if (!access.rows[0].can_manage && !isAssignedOwner) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'You can update only tasks assigned to you.' }, { status: 403 });
    }
    if (!access.rows[0].can_manage && (
      Object.prototype.hasOwnProperty.call(input,'targetQuantity') ||
      Object.prototype.hasOwnProperty.call(input,'actualStartDate') ||
      Object.prototype.hasOwnProperty.call(input,'actualEndDate') ||
      Object.prototype.hasOwnProperty.call(input,'forecastEndDate')
    )) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Only a project manager can change task targets and schedule dates.' }, { status: 403 });
    }
    if (input.status === 'in_progress' || input.status === 'completed') {
      const unmet = await client.query(
        `SELECT predecessor.title, d.dependency_type, predecessor.status
         FROM pm_task_dependencies d
         JOIN pm_tasks predecessor ON predecessor.id=d.depends_on_task_id AND predecessor.organization_id=d.organization_id
         WHERE d.organization_id=$1 AND d.task_id=$2 AND (
           (d.dependency_type='finish_to_start' AND predecessor.status<>'completed') OR
           (d.dependency_type='start_to_start' AND predecessor.actual_start_date IS NULL AND predecessor.status NOT IN ('in_progress','completed')) OR
           (d.dependency_type='finish_to_finish' AND $3='completed' AND predecessor.status<>'completed') OR
           (d.dependency_type='start_to_finish' AND $3='completed' AND predecessor.actual_start_date IS NULL AND predecessor.status NOT IN ('in_progress','completed'))
         ) ORDER BY predecessor.title`,
        [orgId,input.taskId,input.status]);
      if (unmet.rows.length) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: 'This task cannot move to ' + input.status.replaceAll('_',' ') + ' until its predecessor tasks meet their dependency conditions.',
          unmetDependencies: unmet.rows,
        }, { status: 409 });
      }
    }
    const updated = await client.query(
      `UPDATE pm_tasks SET
        status=COALESCE($1,status),
        actual_quantity=COALESCE($2,actual_quantity),
        target_quantity=CASE WHEN $3 THEN $4 ELSE target_quantity END,
        progress_percent=COALESCE($5,progress_percent),
        actual_start_date=CASE WHEN $6 THEN $7::date ELSE actual_start_date END,
        actual_end_date=CASE WHEN $8 THEN $9::date ELSE actual_end_date END,
        forecast_end_date=CASE WHEN $10 THEN $11::date ELSE forecast_end_date END,
        updated_at=now()
       WHERE id=$12 AND organization_id=$13 AND project_id=$14
       RETURNING id,title,status,actual_quantity,target_quantity,progress_percent,actual_start_date,actual_end_date,forecast_end_date`,
      [input.status ?? null,input.actualQuantity ?? null,Object.prototype.hasOwnProperty.call(input,'targetQuantity'),input.targetQuantity ?? null,
       input.progressPercent ?? null,Object.prototype.hasOwnProperty.call(input,'actualStartDate'),input.actualStartDate ?? null,
       Object.prototype.hasOwnProperty.call(input,'actualEndDate'),input.actualEndDate ?? null,
       Object.prototype.hasOwnProperty.call(input,'forecastEndDate'),input.forecastEndDate ?? null,
       input.taskId,orgId,projectId]);
    if (input.status && input.status !== old.status) {
      await client.query(
        'INSERT INTO pm_status_history(organization_id,entity_type,entity_id,previous_status,new_status,reason,changed_by) VALUES($1,\'task\',$2,$3,$4,$5,$6)',
        [orgId,input.taskId,old.status,input.status,input.deviationReason || '',session.user.id]);
    }
    const metric = await client.query(
      `SELECT id FROM pm_performance_metrics
       WHERE organization_id=$1 AND project_id=$2 AND entity_type='task' AND entity_id=$3
       ORDER BY created_at LIMIT 1 FOR UPDATE`, [orgId,projectId,input.taskId]);
    if (metric.rows[0]) {
      await client.query(
        `UPDATE pm_performance_metrics SET
          current_target=CASE WHEN $1 THEN $2 ELSE current_target END,
          actual_value=COALESCE($3,actual_value),
          current_status=COALESCE($4,current_status),
          variance=CASE WHEN COALESCE($1,false) OR $3 IS NOT NULL THEN COALESCE(CASE WHEN $1 THEN $2 ELSE current_target END,0)-COALESCE($3,actual_value,0) ELSE variance END,
          actual_start_date=COALESCE($5,actual_start_date),
          actual_finish_date=COALESCE($6,actual_finish_date),
          forecast_finish_date=COALESCE($7,forecast_finish_date),
          deviation_reason=COALESCE($8,deviation_reason),
          corrective_action=COALESCE($9,corrective_action),
          next_follow_up_at=CASE WHEN $10 THEN $11::timestamptz ELSE next_follow_up_at END,
          updated_by=$12,updated_at=now()
         WHERE id=$13 AND organization_id=$14`,
        [Object.prototype.hasOwnProperty.call(input,'targetQuantity'),input.targetQuantity ?? null,input.actualQuantity ?? null,input.status ?? null,
         input.actualStartDate ?? null,input.actualEndDate ?? null,input.forecastEndDate ?? null,input.deviationReason ?? null,
         input.correctiveAction ?? null,Object.prototype.hasOwnProperty.call(input,'nextFollowUpAt'),input.nextFollowUpAt ?? null,
         session.user.id,metric.rows[0].id,orgId]);
      await client.query(
        `INSERT INTO pm_performance_measurements(organization_id,metric_id,target_value,actual_value,status,note,measured_by)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [orgId,metric.rows[0].id,updated.rows[0].target_quantity,updated.rows[0].actual_quantity,updated.rows[0].status,
         input.deviationReason || '',session.user.id]);
    }
    await client.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,before_data,after_data)
       VALUES($1,$2,$3,'task.updated','task',$4,$5::jsonb,$6::jsonb)`,
      [orgId,session.user.id,projectId,input.taskId,JSON.stringify(old),JSON.stringify(updated.rows[0])]);
    await client.query('COMMIT');
    return NextResponse.json({ task: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Project task update failed', error);
    return NextResponse.json({ error: 'Could not update the task. No changes were saved.' }, { status: 503 });
  } finally { client.release(); }
}
