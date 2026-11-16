import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordOrganizationUsage } from '@/lib/server/organization-entitlements';

export const runtime = 'nodejs';

const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).default(''),
  projectType: z.string().trim().min(2).max(60).default('engineering_construction'),
  clientName: z.string().trim().max(160).optional().default(''),
  currencyCode: z.string().trim().length(3).toUpperCase().default('INR'),
  baselineStartDate: z.string().date().optional().nullable(),
  baselineEndDate: z.string().date().optional().nullable(),
  contractValue: z.number().nonnegative().optional().nullable(),
  approvedBudget: z.number().nonnegative().optional().nullable(),
}).refine((v) => !v.baselineStartDate || !v.baselineEndDate || v.baselineEndDate >= v.baselineStartDate, {
  message: 'Planned finish date must be on or after planned start date.',
  path: ['baselineEndDate'],
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to access Project Management.' }, { status: 401 });
  try {
    const organizations = await db.query(
      `SELECT o.id, o.name, o.slug, m.role,
              COUNT(p.id)::int AS project_count
         FROM organization_accounts o
         JOIN organization_memberships m ON m.organization_id=o.id
         LEFT JOIN pm_projects p ON p.organization_id=o.id AND p.status <> 'archived'
        WHERE m.user_id=$1 AND m.status='active' AND o.status='active'
        GROUP BY o.id,o.name,o.slug,m.role
        ORDER BY o.name
        LIMIT 100`,
      [session.user.id],
    );
    const projects = await db.query(
      `SELECT p.id,p.organization_id,p.project_code,p.name,p.description,p.project_type,
              p.client_name,p.currency_code,p.baseline_start_date,p.baseline_end_date,
              p.actual_start_date,p.actual_end_date,p.forecast_end_date,p.contract_value,
              p.approved_budget,p.status,p.progress_percent,p.created_at,
              o.name AS organization_name,
              COUNT(DISTINCT t.id)::int AS task_count,
              COUNT(DISTINCT t.id) FILTER (WHERE t.status='completed')::int AS completed_task_count
         FROM pm_projects p
         JOIN organization_accounts o ON o.id=p.organization_id
         JOIN organization_memberships m ON m.organization_id=o.id
         LEFT JOIN pm_tasks t ON t.project_id=p.id AND t.organization_id=p.organization_id
        WHERE m.user_id=$1 AND m.status='active' AND o.status='active'
          AND (m.role IN ('owner','admin') OR EXISTS (
            SELECT 1 FROM pm_project_members pmx JOIN pm_memberships mmx ON mmx.id=pmx.membership_id
             WHERE pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.status='active' AND mmx.user_id=$1 AND mmx.status='active'
          ))
        GROUP BY p.id,o.name
        ORDER BY p.updated_at DESC
        LIMIT 200`,
      [session.user.id],
    );
    return NextResponse.json({ organizations: organizations.rows, projects: projects.rows });
  } catch (error) {
    console.error('Project Management workspace load failed', error);
    return NextResponse.json({ error: 'Project Management is temporarily unavailable. Please retry shortly.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to create a project.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the project details.' }, { status: 400 });

  const input = parsed.data;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const membership = await client.query(
      `SELECT o.id,m.role
         FROM organization_accounts o
         JOIN organization_memberships m ON m.organization_id=o.id
        WHERE o.id=$1 AND m.user_id=$2 AND m.status='active' AND o.status='active' AND m.role IN ('owner','admin')
        FOR UPDATE OF o`,
      [input.organizationId, session.user.id],
    );
    if (!membership.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'You do not have access to this organization.' }, { status: 403 });
    }

    await client.query(
      `INSERT INTO pm_organization_settings(organization_id)
       VALUES($1) ON CONFLICT(organization_id) DO NOTHING`,
      [input.organizationId],
    );
    const pmMember = await client.query(
      `INSERT INTO pm_memberships(organization_id,user_id,status,joined_at)
       VALUES($1,$2,'active',now())
       ON CONFLICT(organization_id,user_id) DO UPDATE SET status='active',updated_at=now()
       RETURNING id`,
      [input.organizationId, session.user.id],
    );
    const codeResult = await client.query(
      `SELECT 'PRJ-' || lpad((COALESCE(MAX(NULLIF(regexp_replace(project_code,'[^0-9]','','g'), '')::bigint),0)+1)::text,5,'0') AS code
         FROM pm_projects WHERE organization_id=$1`,
      [input.organizationId],
    );
    const created = await client.query(
      `INSERT INTO pm_projects(
         organization_id,project_code,name,description,project_type,client_name,currency_code,
         baseline_start_date,baseline_end_date,contract_value,approved_budget,
         project_manager_membership_id,created_by,status
       ) VALUES($1,$2,$3,$4,$5,NULLIF($6,''),$7,$8,$9,$10,$11,$12,$13,'planning')
       RETURNING id,organization_id,project_code,name,status,created_at`,
      [input.organizationId, codeResult.rows[0].code, input.name, input.description, input.projectType,
       input.clientName, input.currencyCode, input.baselineStartDate || null, input.baselineEndDate || null,
       input.contractValue ?? null, input.approvedBudget ?? null, pmMember.rows[0].id, session.user.id],
    );
    await client.query(
      `INSERT INTO pm_project_members(organization_id,project_id,membership_id,project_role,access_level)
       VALUES($1,$2,$3,'project_manager','project_admin') ON CONFLICT(project_id,membership_id) DO NOTHING`,
      [input.organizationId, created.rows[0].id, pmMember.rows[0].id],
    );
    await client.query(
      `INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,after_data)
       VALUES($1,$2,$3,'project.created','project',$3,$4::jsonb)`,
      [input.organizationId, session.user.id, created.rows[0].id, JSON.stringify({ name: input.name, projectCode: codeResult.rows[0].code })],
    );
    await recordOrganizationUsage(client,{organizationId:input.organizationId,meterCode:'projects_created',quantity:1,unit:'project',idempotencyKey:'project_created:'+created.rows[0].id,actorUserId:session.user.id,sourceType:'project',sourceId:created.rows[0].id});
    await client.query('COMMIT');
    return NextResponse.json({ project: created.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Project creation failed', error);
    return NextResponse.json({ error: 'Could not create the project. No changes were saved.' }, { status: 503 });
  } finally {
    client.release();
  }
}
