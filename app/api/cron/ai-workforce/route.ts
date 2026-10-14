import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Agent = {
  id: number;
  agent_key: string;
  display_name: string;
  department_code: string;
  team_name: string | null;
  agent_level: string;
  responsibilities: string;
};

function safeJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI returned no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const supplied = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : request.nextUrl.searchParams.get('key');
  if (!secret || !supplied || supplied !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized or CRON_SECRET is not configured' }, { status: 401 });
  }

  const apiKey = process.env.AI_WORKFORCE_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'Configure AI_WORKFORCE_API_KEY (or OPENAI_API_KEY) in Vercel environment variables.' }, { status: 503 });
  }

  const model = process.env.AI_WORKFORCE_MODEL || 'gpt-4.1-mini';
  const run = await db.query(
    `INSERT INTO ai_workforce_runs(run_key,status) VALUES ($1,'running') RETURNING id`,
    [`cron:${new Date().toISOString().slice(0, 13)}`],
  );
  const runId = Number(run.rows[0].id);
  let processed = 0;
  let completed = 0;
  const summaries: string[] = [];

  try {
    // Seed one daily review task per enabled department manager and the central orchestrator.
    // The daily cron processes up to ten tasks per run, covering the initial review and daily manager reviews.
    await db.query(
      `INSERT INTO ai_workforce_tasks
         (agent_id, department_code, title, task_description, priority, status, requires_approval)
       SELECT a.id, a.department_code,
              'Daily AI operations review — ' || a.display_name,
              'Prepare a concise daily review for your assigned responsibility. Identify the most important checks, risks, and practical next steps. Use only verified facts supplied in the task or safely available from your role context; explicitly state when live evidence is missing. Do not change production data, contact users, publish content, spend money, change access/security, or execute financial actions. Escalate sensitive decisions for owner approval.',
              'normal', 'queued', FALSE
       FROM ai_workforce_agents a
       WHERE a.enabled IS TRUE
         AND a.agent_level IN ('orchestrator','department_manager')
         AND NOT EXISTS (
           SELECT 1 FROM ai_workforce_tasks t
           WHERE t.agent_id=a.id
             AND t.title='Daily AI operations review — ' || a.display_name
             AND t.created_at >= date_trunc('day', now())
         )`,
    );

    const pending = await db.query(
      `SELECT t.id AS task_id, t.title, t.task_description, t.department_code AS task_department,
              a.id AS agent_id, a.agent_key, a.display_name, a.department_code, a.team_name,
              a.agent_level, a.responsibilities
       FROM ai_workforce_tasks t
       LEFT JOIN ai_workforce_agents a ON a.id=t.agent_id
       WHERE t.status='queued' AND (a.enabled IS TRUE OR a.id IS NULL)
       ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.created_at
       LIMIT 10`,
    );

    for (const row of pending.rows as any[]) {
      processed++;
      await db.query(`UPDATE ai_workforce_tasks SET status='running', started_at=now(), error_message=NULL WHERE id=$1 AND status='queued'`, [row.task_id]);
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'You are a specialist AI operations agent inside DigiNanba, a global digital-product marketplace. Produce a practical analysis and recommended next steps using only facts supplied in the task. Do not claim you accessed live systems unless data is provided. Never execute actions, reveal secrets, invent metrics, approve payments/refunds, alter access/security, make legal/tax determinations, publish externally, or spend money. Flag assumptions and escalate sensitive decisions for human approval. Return JSON with keys: summary (string), findings (array of strings), recommendations (array of strings), requires_human_approval (boolean), confidence (low|medium|high).' },
              { role: 'user', content: JSON.stringify({
                agent: row.display_name || 'Central AI Orchestrator',
                level: row.agent_level || 'orchestrator',
                department: row.department_code || row.task_department,
                team: row.team_name,
                responsibilities: row.responsibilities || 'Coordinate task review and recommendations.',
                task: { title: row.title, description: row.task_description },
                instruction: 'Perform this assigned task as an analysis/recommendation only. Do not imply work was completed outside this response.'
              }) }
            ]
          }),
        });
        if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
        const payload = await response.json() as any;
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('AI provider returned an empty response');
        const result = safeJson(content);
        const approval = Boolean(result.requires_human_approval);
        const summary = String(result.summary || 'Agent produced a result').slice(0, 4000);
        await db.query(
          `UPDATE ai_workforce_tasks
           SET status=$2, result_summary=$3, result_json=$4::jsonb, completed_at=now(), error_message=NULL
           WHERE id=$1`,
          [row.task_id, approval ? 'needs_approval' : 'completed', summary, JSON.stringify(result)],
        );
        completed++;
        summaries.push(`${row.display_name || 'Orchestrator'}: ${summary}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown agent error';
        await db.query(`UPDATE ai_workforce_tasks SET status='failed', error_message=$2, completed_at=now() WHERE id=$1`, [row.task_id, message.slice(0, 1000)]);
        summaries.push(`Task ${row.task_id} failed: ${message}`);
      }
    }

    const status = processed === completed ? 'completed' : completed > 0 ? 'partial' : processed === 0 ? 'completed' : 'failed';
    await db.query(
      `UPDATE ai_workforce_runs SET status=$2, agents_processed=$3, tasks_created=0, summary=$4, completed_at=now() WHERE id=$1`,
      [runId, status, processed, summaries.join('\n').slice(0, 8000) || 'No queued tasks were available.'],
    );
    return NextResponse.json({ ok: true, runId, model, tasksProcessed: processed, tasksWithResults: completed, message: processed ? 'Queued analysis tasks processed.' : 'No queued tasks.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workforce error';
    await db.query(`UPDATE ai_workforce_runs SET status='failed', error_message=$2, completed_at=now() WHERE id=$1`, [runId, message.slice(0, 1000)]);
    return NextResponse.json({ ok: false, runId, error: message }, { status: 500 });
  }
}
