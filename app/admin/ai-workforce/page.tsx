import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import TaskReviewActions from './TaskReviewActions';

export const dynamic = 'force-dynamic';

export default async function AIWorkforcePage() {
  const session = await auth();
  if (!session?.user) redirect('/admin/login');
  const roleResult = await db.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     WHERE ur.user_id=$1 AND r.name IN ('Super Admin','Operations Admin') LIMIT 1`,
    [session.user.id],
  );
  if (!roleResult.rowCount) redirect('/account');

  let agents: any[] = [];
  let tasks: any[] = [];
  let runs: any[] = [];
  let ready = true;
  try {
    const [a,t,r] = await Promise.all([
      db.query(`SELECT agent_level, department_code, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE enabled)::int AS enabled FROM ai_workforce_agents GROUP BY agent_level,department_code ORDER BY department_code,agent_level`),
      db.query(`SELECT t.id,t.title,t.department_code,t.team_name,t.priority,t.status,t.result_summary,t.result_json,t.requires_approval,t.approved_by,t.approved_at,t.error_message,t.created_at,a.display_name AS agent_name FROM ai_workforce_tasks t LEFT JOIN ai_workforce_agents a ON a.id=t.agent_id ORDER BY t.created_at DESC LIMIT 30`),
      db.query(`SELECT id,status,agents_processed,tasks_created,summary,error_message,started_at,completed_at FROM ai_workforce_runs ORDER BY started_at DESC LIMIT 10`),
    ]);
    agents=a.rows; tasks=t.rows; runs=r.rows;
  } catch (error) {
    ready=false;
    console.error('[admin:ai-workforce] tables unavailable; apply AI workforce migration', error);
  }
  const count=(status:string)=>tasks.filter(t=>t.status===status).length;
  const panel={background:'#fff',border:'1px solid #e7e9f1',borderRadius:16,padding:18};
  return <main style={{minHeight:'100vh',background:'#f5f6fb',color:'#182033',fontFamily:'Arial,Helvetica,sans-serif',padding:'clamp(16px,3vw,36px)'}}>
    <div style={{maxWidth:1250,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:18}}>
        <Link href="/admin" style={{textDecoration:'none',color:'#30247e',fontWeight:850,fontSize:18}}>DigiNanba · ADMIN</Link>
        <nav style={{display:'flex',gap:8,overflowX:'auto',scrollbarGutter:'stable'}}>
          {[['/admin','Overview'],['/admin/team','Team & hierarchy'],['/admin/factory','AI Product Factory'],['/admin/business','Business analytics']].map(([href,label])=><Link key={href} href={href} style={{flex:'0 0 auto',whiteSpace:'nowrap',textDecoration:'none',borderRadius:999,padding:'10px 13px',fontSize:12,fontWeight:750,background:'#fff',color:'#586176',border:'1px solid #e5e7f0'}}>{label}</Link>)}
        </nav>
      </header>
      <section style={{background:'linear-gradient(120deg,#1c2755,#5143d8)',color:'#fff',borderRadius:22,padding:'clamp(22px,3vw,34px)',margin:'12px 0 22px'}}>
        <div style={{fontSize:11,letterSpacing:1.5,fontWeight:850,color:'#d9d4ff'}}>AUTONOMOUS OPERATIONS</div>
        <h1 style={{fontSize:'clamp(27px,3.5vw,38px)',letterSpacing:-1,margin:'10px 0'}}>DigiNanba AI Workforce</h1>
        <p style={{maxWidth:850,lineHeight:1.7,color:'#eceaff',margin:0}}>One central orchestrator, eight AI department managers and specialist team-leader/staff agents. Scheduled agents analyze queued work, store reports and flag decisions requiring owner approval.</p>
      </section>
      {!ready && <section style={{...panel,background:'#fff6df',color:'#765517',marginBottom:18}}>The AI workforce tables are not available yet. Apply <a href="https://github.com/agnengineeringselectricals-crypto/diginanba/blob/main/db/migrations/20261014_ai_workforce_foundation.sql">the AI workforce migration in Neon</a>, then refresh.</section>}
      {ready && <>
        <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12,marginBottom:22}}>
          {[
            ['AI agents',agents.reduce((s,a)=>s+Number(a.total),0)],
            ['Enabled agents',agents.reduce((s,a)=>s+Number(a.enabled),0)],
            ['Queued tasks',count('queued')],
            ['Needs approval',count('needs_approval')],
            ['Completed tasks',count('completed')],
            ['Failed tasks',count('failed')],
          ].map(([label,value])=><article key={String(label)} style={panel}><div style={{fontSize:12,color:'#778095',fontWeight:750}}>{label}</div><div style={{fontSize:30,fontWeight:850,marginTop:8}}>{value}</div></article>)}
        </section>
        <section style={{...panel,marginBottom:22}}>
          <h2 style={{fontSize:20,margin:'0 0 12px'}}>AI agent roster</h2>
          <p style={{fontSize:13,color:'#778095',lineHeight:1.6,marginTop:0}}>Agents are software roles, not paid employees. The current runner produces analysis and recommendations; it does not autonomously execute payments, security changes, external publishing or other sensitive operations.</p>
          <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}><thead><tr>{['Department / scope','Agent level','Total','Enabled'].map(x=><th key={x} style={{textAlign:'left',padding:10,borderBottom:'1px solid #e7e9f1',color:'#778095'}}>{x}</th>)}</tr></thead><tbody>{agents.map((a,i)=><tr key={i}>{[a.department_code,a.agent_level,a.total,a.enabled].map((x,j)=><td key={j} style={{padding:10,borderBottom:'1px solid #f0f1f6'}}>{x}</td>)}</tr>)}</tbody></table></div>
        </section>
        <section style={{...panel,marginBottom:22}}>
          <h2 style={{fontSize:20,margin:'0 0 12px'}}>Recent tasks</h2>
          {tasks.length===0?<p style={{color:'#778095',fontSize:13}}>No tasks yet. The initial orchestrator review is seeded by the migration.</p>:
          <div style={{display:'grid',gap:10}}>{tasks.map(t=><article key={t.id} style={{border:'1px solid #e7e9f1',borderRadius:12,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>{t.title}</strong><span style={{fontSize:11,fontWeight:800,color:t.status==='failed'?'#b42318':t.status==='needs_approval'?'#9a6700':t.status==='completed'?'#087f65':'#596276',background:'#f3f4f8',borderRadius:999,padding:'5px 8px'}}>{t.status}</span></div>
            <div style={{fontSize:11,color:'#778095',marginTop:6}}>{t.agent_name || 'Unassigned agent'} · {t.department_code}{t.team_name ? ' / '+t.team_name : ''} · Priority: {t.priority} · {new Date(t.created_at).toLocaleString('en-IN')}</div>
            {t.result_summary&&<p style={{fontSize:13,lineHeight:1.6,marginBottom:0}}>{t.result_summary}</p>}
            {t.error_message&&<p style={{fontSize:12,color:'#b42318',lineHeight:1.5,marginBottom:0}}>{t.error_message}</p>}
            <TaskReviewActions taskId={t.id} status={t.status} resultJson={t.result_json ?? null} approvedBy={t.approved_by ?? null} approvedAt={t.approved_at ? new Date(t.approved_at).toISOString() : null} />
          </article>)}</div>}
        </section>
        <section style={panel}>
          <h2 style={{fontSize:20,margin:'0 0 12px'}}>Execution history</h2>
          {runs.length===0?<p style={{color:'#778095',fontSize:13}}>No scheduled runs yet.</p>:<div style={{display:'grid',gap:10}}>{runs.map(r=><article key={r.id} style={{borderBottom:'1px solid #edf0f5',padding:'8px 0'}}><strong>{r.status}</strong><span style={{fontSize:12,color:'#778095'}}> · {new Date(r.started_at).toLocaleString('en-IN')} · tasks processed: {r.agents_processed}</span>{r.summary&&<p style={{fontSize:12,color:'#596276',lineHeight:1.6,margin:'6px 0'}}>{r.summary}</p>}{r.error_message&&<p style={{fontSize:12,color:'#b42318'}}>{r.error_message}</p>}</article>)}</div>}
        </section>
      </>}
      <p style={{fontSize:12,color:'#778095',lineHeight:1.7,marginTop:18}}>Setup requirements: apply the Neon migration; configure CRON_SECRET and AI_WORKFORCE_API_KEY in Vercel. Optional AI_WORKFORCE_MODEL defaults to gpt-4.1-mini. The scheduled runner processes up to four queued tasks per hour to control costs.</p>
    </div>
  </main>;
}
