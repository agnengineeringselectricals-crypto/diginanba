import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectPermission } from '@/lib/server/project-permissions';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to view performance.' }, { status: 401 });
  const { projectId } = await context.params;
  if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });
  try {
    const access = await db.query(
      `SELECT p.organization_id FROM pm_projects p JOIN organization_accounts org_active ON org_active.id=p.organization_id AND org_active.status='active' JOIN organization_memberships m ON m.organization_id=p.organization_id
       WHERE p.id=$1 AND m.user_id=$2 AND m.status='active' AND p.status <> 'archived'
         AND (m.role IN ('owner','admin') OR EXISTS (
           SELECT 1 FROM pm_project_members pmx JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
           WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.status='active'
             AND mmx.user_id=$2 AND mmx.status='active'
         )) LIMIT 1`, [projectId, session.user.id]);
    if (!access.rows[0]) return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
    const orgId = access.rows[0].organization_id as string;
    const metrics = await db.query(
      `SELECT m.id,m.entity_type,m.entity_id,m.metric_code,m.metric_name,m.unit,
              m.baseline_target,m.current_target,m.actual_value,m.current_status,m.variance,
              m.planned_start_date,m.planned_finish_date,m.actual_start_date,m.actual_finish_date,
              m.forecast_finish_date,m.deviation_reason,m.corrective_action,m.next_follow_up_at,
              t.title AS task_title,t.task_code,t.progress_percent,t.owner_membership_id,
              u.display_name AS responsible_name,
              latest.measured_at AS last_measured_at,latest.target_value AS last_target_value,
              latest.actual_value AS last_actual_value,latest.status AS last_status,
              latest.note AS last_note,
              COALESCE(history.measurement_count,0)::int AS measurement_count
       FROM pm_performance_metrics m
       LEFT JOIN pm_tasks t ON m.entity_type='task' AND t.id=m.entity_id
         AND t.organization_id=m.organization_id AND t.project_id=m.project_id
       LEFT JOIN pm_memberships pm ON pm.id=m.responsible_membership_id AND pm.organization_id=m.organization_id
       LEFT JOIN users u ON u.id=pm.user_id
       LEFT JOIN LATERAL (
         SELECT measured_at,target_value,actual_value,status,note
         FROM pm_performance_measurements x
         WHERE x.metric_id=m.id AND x.organization_id=m.organization_id
         ORDER BY measured_at DESC,created_at DESC LIMIT 1
       ) latest ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS measurement_count FROM pm_performance_measurements x
         WHERE x.metric_id=m.id AND x.organization_id=m.organization_id
       ) history ON true
       WHERE m.organization_id=$1 AND m.project_id=$2
         AND ($3::text NOT IN ('assigned','own') OR (m.responsible_membership_id=$4 OR t.owner_membership_id=$4))
         AND ($3::text <> 'department' OR pm.department_id=$5)
       ORDER BY m.created_at,m.metric_name LIMIT 1000`, [orgId, projectId, permission.scope, permission.membershipId, permission.departmentId]);
    const summary = await db.query(
      `SELECT COUNT(*)::int AS metric_count,
              COUNT(*) FILTER (WHERE current_status='completed')::int AS completed_count,
              COUNT(*) FILTER (WHERE current_status IN ('blocked','at_risk','on_hold'))::int AS attention_count,
              COUNT(*) FILTER (WHERE next_follow_up_at IS NOT NULL AND next_follow_up_at <= now())::int AS overdue_followups,
              COALESCE(SUM(current_target),0)::numeric AS total_target,
              COALESCE(SUM(actual_value),0)::numeric AS total_actual
       FROM pm_performance_metrics m LEFT JOIN pm_tasks t ON m.entity_type='task' AND t.id=m.entity_id AND t.organization_id=m.organization_id AND t.project_id=m.project_id LEFT JOIN pm_memberships pm ON pm.id=m.responsible_membership_id AND pm.organization_id=m.organization_id WHERE m.organization_id=$1 AND m.project_id=$2 AND ($3::text NOT IN ('assigned','own') OR (m.responsible_membership_id=$4 OR t.owner_membership_id=$4)) AND ($3::text <> 'department' OR pm.department_id=$5)`, [orgId, projectId, permission.scope, permission.membershipId, permission.departmentId]);
    return NextResponse.json({ metrics: metrics.rows, summary: summary.rows[0] });
  } catch (error) {
    console.error('Project performance report failed', error);
    return NextResponse.json({ error: 'Performance report is temporarily unavailable.' }, { status: 503 });
  }
}
