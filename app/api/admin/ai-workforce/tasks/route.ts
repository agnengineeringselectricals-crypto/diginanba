import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const rolesResult = await db.query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );
  const roles = new Set<string>(rolesResult.rows.map((row: { name: string }) => String(row.name)));
  if (!roles.has('Super Admin') && !roles.has('Operations Admin')) {
    return NextResponse.json({ error: 'Only Super Admin or Operations Admin can review AI workforce tasks' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { taskId?: unknown; decision?: unknown } | null;
  const taskId = typeof body?.taskId === 'string' && /^\d+$/.test(body.taskId) ? body.taskId : null;
  const decision = body?.decision;
  if (!taskId || (decision !== 'approve' && decision !== 'reject')) {
    return NextResponse.json({ error: 'Provide a numeric taskId and decision approve or reject' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const taskResult = await client.query(
      `SELECT id, title, status, result_summary, requires_approval, approved_by, approved_at
       FROM ai_workforce_tasks WHERE id = $1 FOR UPDATE`,
      [taskId],
    );
    const task = taskResult.rows[0];
    if (!task) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'AI workforce task not found' }, { status: 404 });
    }
    if (task.status !== 'needs_approval') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Only tasks currently marked needs_approval can be reviewed' }, { status: 409 });
    }

    const nextStatus = decision === 'approve' ? 'completed' : 'cancelled';
    const reviewer = decision === 'approve' ? userId : `rejected:${userId}`;
    await client.query(
      `UPDATE ai_workforce_tasks
       SET status = $2, requires_approval = FALSE, approved_by = $3, approved_at = now()
       WHERE id = $1`,
      [taskId, nextStatus, reviewer],
    );
    await client.query(
      `INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id, before_json, after_json, result)
       VALUES($1, $2, 'ai_workforce_task', $3, $4::jsonb, $5::jsonb, 'success')`,
      [
        userId,
        decision === 'approve' ? 'ai_workforce.task_approved' : 'ai_workforce.task_rejected',
        taskId,
        JSON.stringify({ status: task.status, requiresApproval: task.requires_approval }),
        JSON.stringify({ status: nextStatus, decision, reviewer: userId }),
      ],
    );
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, taskId, decision, status: nextStatus });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[admin:ai-workforce] task review failed', error);
    return NextResponse.json({ error: 'Unable to save the review decision' }, { status: 503 });
  } finally {
    client.release();
  }
}
