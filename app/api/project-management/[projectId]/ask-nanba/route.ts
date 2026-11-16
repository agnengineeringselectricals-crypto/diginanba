import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordOrganizationUsage } from '@/lib/server/organization-entitlements';

export const runtime = 'nodejs';
export const maxDuration = 30;

const inputSchema = z.object({ question: z.string().trim().min(3).max(1200) });

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to ask Nanba about this project.' }, { status: 401 });

  const { projectId } = await context.params;
  if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a project question (up to 1,200 characters).' }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Ask AI Nanba is not configured yet. The project assistant needs an OpenAI API key; no response has been generated or charged.' }, { status: 503 });

  try {
    const accessResult = await db.query(
      `SELECT p.id,p.organization_id,p.project_code,p.name,p.description,p.status,p.progress_percent,
              p.currency_code,p.baseline_start_date,p.baseline_end_date,p.forecast_end_date,p.approved_budget,
              m.role AS organization_role,
              mine.id AS actor_membership_id,
              pmx.access_level,
              (m.role IN ('owner','admin') OR pmx.access_level='project_admin') AS can_manage
       FROM pm_projects p JOIN organization_accounts org_active ON org_active.id=p.organization_id AND org_active.status='active' JOIN organization_memberships m ON m.organization_id=p.organization_id
       LEFT JOIN pm_memberships mine ON mine.organization_id=p.organization_id AND mine.user_id=$2 AND mine.status='active'
       LEFT JOIN pm_project_members pmx ON pmx.project_id=p.id AND pmx.organization_id=p.organization_id
         AND pmx.membership_id=mine.id AND pmx.status='active'
       WHERE p.id=$1 AND p.status<>'archived' AND m.user_id=$2 AND m.status='active'
         AND (m.role IN ('owner','admin') OR pmx.membership_id IS NOT NULL)
       LIMIT 1`,
      [projectId, session.user.id],
    );
    const access = accessResult.rows[0];
    if (!access) return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });

    const restricted = access.organization_role !== 'owner' && access.organization_role !== 'admin' && access.access_level === 'assigned';
    const memberId = access.actor_membership_id as string | null;
    const orgId = access.organization_id as string;

    const usage = await db.query(
      `SELECT COUNT(*) FILTER (WHERE user_id=$3 AND created_at >= now()-interval '24 hours')::int AS user_requests,
              COUNT(*) FILTER (WHERE created_at >= now()-interval '24 hours')::int AS organization_requests
       FROM pm_ai_assistant_usage WHERE organization_id=$1 AND project_id=$2`,
      [orgId, projectId, session.user.id],
    );
    if (Number(usage.rows[0]?.user_requests || 0) >= 25 || Number(usage.rows[0]?.organization_requests || 0) >= 150) {
      return NextResponse.json({ error: 'The project assistant has reached its rolling 24-hour usage limit. Please try again later.' }, { status: 429 });
    }

    const [tasks, packages, dependencies, milestones, metrics, approvals, procurement, manpower, quality, finance, documents] = await Promise.all([
      db.query(
        `SELECT t.task_code,t.title,t.description,t.status,t.priority,t.progress_percent,t.target_quantity,t.actual_quantity,t.unit,
                t.planned_start_date,t.planned_end_date,t.forecast_end_date,u.display_name AS owner
         FROM pm_tasks t
         LEFT JOIN pm_memberships pm ON pm.id=t.owner_membership_id AND pm.organization_id=t.organization_id
         LEFT JOIN users u ON u.id=pm.user_id
         WHERE t.organization_id=$1 AND t.project_id=$2 AND ($3::uuid IS NULL OR t.owner_membership_id=$3)
         ORDER BY CASE WHEN t.status IN ('blocked','on_hold') THEN 0 ELSE 1 END,t.planned_end_date NULLS LAST
         LIMIT 100`,
        [orgId, projectId, restricted ? memberId : null],
      ),
      db.query(
        `SELECT package_code,name,description FROM pm_work_packages
         WHERE organization_id=$1 AND project_id=$2 ORDER BY sort_order,name LIMIT 80`,
        [orgId, projectId],
      ),
      db.query(
        `SELECT t.title AS task, predecessor.title AS depends_on,d.dependency_type,d.lag_days
         FROM pm_task_dependencies d
         JOIN pm_tasks t ON t.id=d.task_id AND t.organization_id=d.organization_id AND t.project_id=$2
         JOIN pm_tasks predecessor ON predecessor.id=d.depends_on_task_id AND predecessor.organization_id=d.organization_id AND predecessor.project_id=$2
         WHERE d.organization_id=$1 AND ($3::uuid IS NULL OR t.owner_membership_id=$3 OR predecessor.owner_membership_id=$3)
         LIMIT 120`,
        [orgId, projectId, restricted ? memberId : null],
      ),
      db.query(
        `SELECT name,description,baseline_date,forecast_date,actual_date,status
         FROM pm_project_milestones WHERE organization_id=$1 AND project_id=$2
           AND ($3::uuid IS NULL OR owner_membership_id=$3)
         ORDER BY baseline_date NULLS LAST LIMIT 80`,
        [orgId, projectId, restricted ? memberId : null],
      ),
      db.query(
        `SELECT m.metric_name,m.unit,m.current_target,m.actual_value,m.current_status,m.variance,
                m.planned_finish_date,m.forecast_finish_date,m.deviation_reason,m.corrective_action,
                m.next_follow_up_at,t.title AS task
         FROM pm_performance_metrics m
         LEFT JOIN pm_tasks t ON m.entity_type='task' AND t.id=m.entity_id AND t.organization_id=m.organization_id AND t.project_id=m.project_id
         WHERE m.organization_id=$1 AND m.project_id=$2
           AND ($3::uuid IS NULL OR m.responsible_membership_id=$3 OR t.owner_membership_id=$3)
         ORDER BY CASE WHEN m.current_status IN ('blocked','at_risk','on_hold') THEN 0 ELSE 1 END,m.next_follow_up_at NULLS LAST
         LIMIT 100`,
        [orgId, projectId, restricted ? memberId : null],
      ),
      db.query(
        `SELECT a.title,a.entity_type,a.approval_type,a.status,a.requested_at,
                COUNT(s.id)::int AS step_count,
                COUNT(s.id) FILTER (WHERE s.status='pending')::int AS pending_steps
         FROM pm_approval_requests a
         LEFT JOIN pm_approval_steps s ON s.approval_request_id=a.id AND s.organization_id=a.organization_id
         WHERE a.organization_id=$1 AND a.project_id=$2
           AND ($3::uuid IS NULL OR a.requested_by=$4 OR EXISTS(
             SELECT 1 FROM pm_approval_steps mine WHERE mine.approval_request_id=a.id
               AND mine.organization_id=a.organization_id AND mine.approver_membership_id=$3))
         GROUP BY a.id ORDER BY a.requested_at DESC LIMIT 80`,
        [orgId, projectId, restricted ? memberId : null, session.user.id],
      ),
      restricted ? Promise.resolve({ rows: [{ access: 'Not included for assigned-task access' }] }) : db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM pm_suppliers WHERE organization_id=$1 AND status='active') AS active_suppliers,
           (SELECT COUNT(*)::int FROM pm_purchase_orders WHERE organization_id=$1 AND project_id=$2) AS purchase_orders,
           (SELECT COUNT(*)::int FROM pm_purchase_orders WHERE organization_id=$1 AND project_id=$2 AND status IN ('draft','pending_approval','issued','partially_received')) AS open_purchase_orders,
           (SELECT COUNT(*)::int FROM pm_goods_receipts g JOIN pm_purchase_orders p ON p.id=g.purchase_order_id AND p.organization_id=g.organization_id WHERE g.organization_id=$1 AND p.project_id=$2) AS goods_receipts,
           (SELECT COALESCE(SUM(gi.accepted_quantity),0) FROM pm_goods_receipt_items gi JOIN pm_goods_receipts g ON g.id=gi.receipt_id AND g.organization_id=gi.organization_id JOIN pm_purchase_orders p ON p.id=g.purchase_order_id AND p.organization_id=g.organization_id WHERE gi.organization_id=$1 AND p.project_id=$2) AS accepted_quantity,
           (SELECT COALESCE(SUM(gi.rejected_quantity),0) FROM pm_goods_receipt_items gi JOIN pm_goods_receipts g ON g.id=gi.receipt_id AND g.organization_id=gi.organization_id JOIN pm_purchase_orders p ON p.id=g.purchase_order_id AND p.organization_id=g.organization_id WHERE gi.organization_id=$1 AND p.project_id=$2) AS rejected_quantity`,
        [orgId, projectId],
      ),
      db.query(
        `SELECT COUNT(*)::int AS assignments,
                COUNT(*) FILTER (WHERE status IN ('planned','active'))::int AS active_assignments,
                COALESCE(SUM(planned_hours),0) AS planned_hours,COALESCE(SUM(actual_hours),0) AS actual_hours
         FROM pm_workforce_assignments WHERE organization_id=$1 AND project_id=$2
           AND ($3::uuid IS NULL OR membership_id=$3)`,
        [orgId, projectId, restricted ? memberId : null],
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM pm_quality_inspections WHERE organization_id=$1 AND project_id=$2 AND ($3::uuid IS NULL OR inspector_membership_id=$3)) AS inspections,
           (SELECT COUNT(*)::int FROM pm_quality_inspections WHERE organization_id=$1 AND project_id=$2 AND result='fail' AND ($3::uuid IS NULL OR inspector_membership_id=$3)) AS failed_inspections,
           (SELECT COUNT(*)::int FROM pm_quality_nonconformities WHERE organization_id=$1 AND project_id=$2 AND ($3::uuid IS NULL OR assigned_to_membership_id=$3)) AS nonconformities,
           (SELECT COUNT(*)::int FROM pm_quality_nonconformities WHERE organization_id=$1 AND project_id=$2 AND status NOT IN ('closed','cancelled') AND ($3::uuid IS NULL OR assigned_to_membership_id=$3)) AS open_nonconformities,
           (SELECT COUNT(*)::int FROM pm_quality_actions a JOIN pm_quality_nonconformities n ON n.id=a.nonconformity_id AND n.organization_id=a.organization_id WHERE a.organization_id=$1 AND n.project_id=$2 AND a.status NOT IN ('completed','cancelled') AND ($3::uuid IS NULL OR a.owner_membership_id=$3)) AS open_corrective_actions`,
        [orgId, projectId, restricted ? memberId : null],
      ),
      restricted ? Promise.resolve({ rows: [{ access: 'Not included for assigned-task access' }] }) : db.query(
        `SELECT b.budget_name,b.currency_code,b.baseline_amount,b.revised_amount,b.committed_amount,b.actual_amount,b.status
         FROM pm_project_budgets b WHERE b.organization_id=$1 AND b.project_id=$2 ORDER BY b.created_at LIMIT 40`,
        [orgId, projectId],
      ),
      restricted ? Promise.resolve({ rows: [{ access: 'Not included for assigned-task access' }] }) : db.query(
        `SELECT d.document_number,d.title,d.document_type,d.revision,d.status,d.updated_at
         FROM pm_documents d WHERE d.organization_id=$1 AND d.project_id=$2 ORDER BY d.updated_at DESC LIMIT 60`,
        [orgId, projectId],
      ),
    ]);

    const projectData = {
      project: {
        code: access.project_code, name: access.name, description: access.description, status: access.status,
        progressPercent: access.progress_percent, currency: access.currency_code,
        baselineStart: access.baseline_start_date, baselineFinish: access.baseline_end_date,
        forecastFinish: access.forecast_end_date, approvedBudget: restricted ? null : access.approved_budget,
      },
      visibility: restricted ? 'Assigned-task scope: only the requesting member’s assigned tasks, related performance, own assignments, assigned quality actions, and approvals are included. Procurement, finance, and document registers are excluded.' : 'Project scope: project records visible to this organization/project member.',
      workBreakdown: packages.rows,
      tasks: tasks.rows,
      dependencies: dependencies.rows,
      milestones: milestones.rows,
      performance: metrics.rows,
      approvals: approvals.rows,
      procurement: procurement.rows,
      manpower: manpower.rows,
      quality: quality.rows,
      finance: finance.rows,
      documents: documents.rows,
      dataLimitations: 'Only records currently stored in DigiNanba are supplied. Empty or missing records mean no data was recorded in the queried workspace; do not infer real-world progress from missing data. Document file contents are never supplied.',
    };

    const model = process.env.PROJECT_AI_MODEL || 'gpt-4o-mini';
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: 'You are Ask AI Nanba, DigiNanba’s project-workflow intelligence assistant. Analyze only the supplied project records. Help project managers, department chiefs, team/stage leaders and assigned staff understand WBS, tasks, dependencies, baseline/forecast/actual targets, progress, pending work, risks, approvals, resources, procurement, quality actions, finance and documents within the supplied visibility scope. Never invent dates, quantities, approvals, causes, progress, or people. Clearly separate recorded facts, reasonable interpretation, and recommended next steps. If the data is missing, say it is not recorded. Do not claim to change tasks, approve anything, send messages, or perform actions; this assistant is read-only and recommendations require an authorized person to act. Respect the visibility note and never infer or reveal excluded information. Use concise headings and actionable bullets.' },
          { role: 'user', content: `Question: ${parsed.data.question}\n\nCurrent project records (JSON):\n${JSON.stringify(projectData)}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const providerError = await aiResponse.json().catch(() => ({}));
      const code = providerError?.error?.code || providerError?.error?.type || 'provider_error';
      console.error('Ask AI Nanba provider request failed', { status: aiResponse.status, code });
      if (aiResponse.status === 429 || code === 'insufficient_quota') {
        return NextResponse.json({ error: 'The AI provider is currently unavailable or out of API credits. No project data was changed. Please check API billing/limits before retrying.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Nanba could not complete this answer right now. No project data was changed.' }, { status: 502 });
    }

    const result = await aiResponse.json();
    const answer = String(result?.choices?.[0]?.message?.content || '').trim();
    if (!answer) return NextResponse.json({ error: 'Nanba returned an empty answer. Please try a more specific question.' }, { status: 502 });

    const inputTokens = Number(result?.usage?.prompt_tokens || 0);
    const outputTokens = Number(result?.usage?.completion_tokens || 0);
    await db.query(
      `INSERT INTO pm_ai_assistant_usage
        (organization_id,project_id,user_id,model,input_tokens,output_tokens,request_status)
       VALUES($1,$2,$3,$4,$5,$6,'succeeded')`,
      [orgId, projectId, session.user.id, model, inputTokens, outputTokens],
    );
    await recordOrganizationUsage(db,{organizationId:orgId,meterCode:'ai_assistant_requests',quantity:1,unit:'request',idempotencyKey:'ai_request:'+crypto.randomUUID(),actorUserId:session.user.id,sourceType:'project_ai_assistant',sourceId:projectId,metadata:{model}});
    if(inputTokens>0)await recordOrganizationUsage(db,{organizationId:orgId,meterCode:'ai_input_tokens',quantity:inputTokens,unit:'token',idempotencyKey:'ai_input:'+crypto.randomUUID(),actorUserId:session.user.id,sourceType:'project_ai_assistant',sourceId:projectId,metadata:{model}});
    if(outputTokens>0)await recordOrganizationUsage(db,{organizationId:orgId,meterCode:'ai_output_tokens',quantity:outputTokens,unit:'token',idempotencyKey:'ai_output:'+crypto.randomUUID(),actorUserId:session.user.id,sourceType:'project_ai_assistant',sourceId:projectId,metadata:{model}});
    await db.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,after_data)
       VALUES($1,$2,$3,'project.ai_assistant.asked','ai_assistant',$4::jsonb)`,
      [orgId, session.user.id, projectId, JSON.stringify({ model, inputTokens, outputTokens, visibility: restricted ? 'assigned' : 'project' })],
    );

    return NextResponse.json({ answer, usage: { inputTokens, outputTokens }, scope: restricted ? 'assigned' : 'project' });
  } catch (error) {
    console.error('Ask AI Nanba failed', error);
    return NextResponse.json({ error: 'Ask AI Nanba is temporarily unavailable. No project records were changed.' }, { status: 503 });
  }
}
