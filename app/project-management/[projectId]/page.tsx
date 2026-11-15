'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type Project = { id:string; organization_id:string; organization_name:string; project_code:string; name:string; description:string; client_name:string|null; currency_code:string; baseline_start_date:string|null; baseline_end_date:string|null; approved_budget:string|null; contract_value:string|null; status:string; progress_percent:number };
type WorkPackage = {id:string;package_code:string|null;name:string;description:string;parent_package_id:string|null;sort_order:number};
type Task = { id:string; task_code:string|null; title:string; description:string; unit:string|null; target_quantity:string|number|null; actual_quantity:string|number; planned_start_date:string|null; planned_end_date:string|null; actual_start_date:string|null; actual_end_date:string|null; forecast_end_date:string|null; priority:string; status:string; progress_percent:number; owner_name:string|null };
const statuses=['not_started','in_progress','blocked','on_hold','completed','cancelled'];
const fmt=(v:string|null)=>v?new Date(v).toLocaleDateString():'—';
const money=(v:string|null,c:string)=>v==null?'—':new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(v));

export default function ProjectDetailPage({params}:{params:Promise<{projectId:string}>}) {
  const [projectId,setProjectId]=useState('');
  const [project,setProject]=useState<Project|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [packages,setPackages]=useState<WorkPackage[]>([]);
  const [packageName,setPackageName]=useState('');
  const [packageDescription,setPackageDescription]=useState('');
  const [selectedPackageId,setSelectedPackageId]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [unit,setUnit]=useState('');
  const [target,setTarget]=useState('');
  const [start,setStart]=useState('');
  const [finish,setFinish]=useState('');
  const [priority,setPriority]=useState('normal');
  const [edits,setEdits]=useState<Record<string,{actual:string;status:string;progress:string}>>({});
  useEffect(()=>{void params.then(p=>setProjectId(p.projectId))},[params]);
  const load=useCallback(async()=>{
    if(!projectId)return;
    setLoading(true);setError('');
    try{
      const [pr,tr,wr]=await Promise.all([
        fetch('/api/project-management',{cache:'no-store'}),
        fetch('/api/project-management/'+projectId+'/tasks',{cache:'no-store'}),
        fetch('/api/project-management/'+projectId+'/work-packages',{cache:'no-store'})
      ]);
      const [pd,td,wd]=await Promise.all([pr.json(),tr.json(),wr.json()]);
      if(!pr.ok)throw new Error(pd.error||'Unable to load project.');
      if(!tr.ok)throw new Error(td.error||'Unable to load tasks.');
      if(!wr.ok)throw new Error(wd.error||'Unable to load work packages.');
      const found=(pd.projects||[]).find((p:Project)=>p.id===projectId);
      if(!found)throw new Error('Project not found or you do not have access.');
      setProject(found);setTasks(td.tasks||[]);setPackages(wd.workPackages||[]);
      setEdits(Object.fromEntries((td.tasks||[]).map((t:Task)=>[t.id,{actual:String(t.actual_quantity??0),status:t.status,progress:String(t.progress_percent??0)}])));
    }catch(e){setError(e instanceof Error?e.message:'Unable to load project.')}
    finally{setLoading(false)}
  },[projectId]);
  useEffect(()=>{void load()},[load]);
  const completed=useMemo(()=>tasks.filter(t=>t.status==='completed').length,[tasks]);
  async function addTask(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');setNotice('');
    try{
      const r=await fetch('/api/project-management/'+projectId+'/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,description,unit:unit||null,targetQuantity:target===''?null:Number(target),plannedStartDate:start||null,plannedEndDate:finish||null,priority,workPackageId:selectedPackageId||null})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create task.');
      setNotice('Task added.');setTitle('');setDescription('');setUnit('');setTarget('');setStart('');setFinish('');await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not create task.')}finally{setSaving(false)}
  }
  async function addPackage(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');setNotice('');
    try{const r=await fetch('/api/project-management/'+projectId+'/work-packages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:packageName,description:packageDescription})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create work package.');setPackageName('');setPackageDescription('');setNotice('Work package created.');await load();}
    catch(e){setError(e instanceof Error?e.message:'Could not create work package.')}finally{setSaving(false)}
  }
  async function saveTask(task:Task){
    const v=edits[task.id];if(!v)return;setSaving(true);setError('');setNotice('');
    try{
      const r=await fetch('/api/project-management/'+projectId+'/tasks',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({taskId:task.id,actualQuantity:Number(v.actual),status:v.status,progressPercent:Number(v.progress)})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not update task.');
      setNotice('Task progress saved.');await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not update task.')}finally{setSaving(false)}
  }
  if(loading&&!project)return <main className="pd-shell"><p>Loading project workspace…</p></main>;
  return <main className="pd-shell">
    <header className="pd-head"><div><Link href="/project-management" className="pd-back">← Project portfolio</Link><div className="pd-brand">DigiNanba <span>Projects</span></div></div><Link href="/organizations" className="pd-org-link">Organization workspace</Link></header>
    {error&&<p className="pd-alert" role="alert">{error}</p>}{notice&&<p className="pd-notice" role="status">{notice}</p>}
    {project&&<>
      <section className="pd-hero"><div><span className="pd-eyebrow">{project.project_code} · {project.organization_name}</span><h1>{project.name}</h1><p>{project.description||'Project workspace and execution control'}{project.client_name?' · Client: '+project.client_name:''}</p></div><span className="pd-status">{project.status.replaceAll('_',' ')}</span></section>
      <section className="pd-stats"><article><small>Tasks</small><strong>{tasks.length}</strong></article><article><small>Completed</small><strong>{completed}</strong></article><article><small>Approved budget</small><strong>{money(project.approved_budget,project.currency_code)}</strong></article><article><small>Planned finish</small><strong>{fmt(project.baseline_end_date)}</strong></article></section>
      <section className="pd-panel"><div className="pd-title"><div><span className="pd-eyebrow">WORK BREAKDOWN</span><h2>Work packages and tasks</h2></div><span className="pd-count">{packages.length} packages · {tasks.length} tasks</span></div>
        {packages.length>0&&<div className="pd-package-list">{packages.map(p=><span key={p.id} className="pd-package">{p.package_code||'WBS'} · {p.name}</span>)}</div>}
        {!tasks.length?<p className="pd-muted">No tasks have been added. Start with the first measurable activity below.</p>:<div className="pd-task-list">{tasks.map(t=><article className="pd-task" key={t.id}>
          <div className="pd-task-info"><strong>{t.title}</strong><small>{t.task_code||'Task'} · {t.priority} priority · {t.owner_name||'Unassigned'}</small><p>{t.description||'No description'}</p><small>Planned: {fmt(t.planned_start_date)} – {fmt(t.planned_end_date)} {t.unit?' · Unit: '+t.unit:''}</small></div>
          <div className="pd-task-edit"><label>Status<select value={edits[t.id]?.status||t.status} onChange={e=>setEdits(s=>({...s,[t.id]:{...s[t.id],status:e.target.value}}))}>{statuses.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label><label>Target {t.unit||'quantity'}<input value={String(t.target_quantity??'—')} readOnly /></label><label>Actual {t.unit||'quantity'}<input type="number" min="0" step="any" value={edits[t.id]?.actual??'0'} onChange={e=>setEdits(s=>({...s,[t.id]:{...s[t.id],actual:e.target.value}}))}/></label><label>Progress %<input type="number" min="0" max="100" value={edits[t.id]?.progress??'0'} onChange={e=>setEdits(s=>({...s,[t.id]:{...s[t.id],progress:e.target.value}}))}/></label><button className="pd-save" disabled={saving} onClick={()=>void saveTask(t)}>Save update</button></div>
        </article>)}</div>}
      </section>
      <section className="pd-panel"><div className="pd-title"><div><span className="pd-eyebrow">WORK BREAKDOWN STRUCTURE</span><h2>Create a work package</h2></div></div><form className="pd-form" onSubmit={addPackage}><label>Package name<input required minLength={2} maxLength={180} value={packageName} onChange={e=>setPackageName(e.target.value)} placeholder="e.g. Electrical installation"/></label><label>Description<input value={packageDescription} onChange={e=>setPackageDescription(e.target.value)} maxLength={5000}/></label><div className="pd-wide pd-actions"><button className="pd-save" disabled={saving||!packageName.trim()}>{saving?'Saving…':'Add work package'}</button></div></form></section>
      <section className="pd-panel"><div className="pd-title"><div><span className="pd-eyebrow">ADD WORK</span><h2>Create a task</h2></div></div><form className="pd-form" onSubmit={addTask}>
        <label className="pd-wide">Task / activity name<input required minLength={2} maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Install main LT panel"/></label>
        <label>Work package<select value={selectedPackageId} onChange={e=>setSelectedPackageId(e.target.value)}><option value="">Unassigned</option>{packages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Unit<input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="Nos, m, kg, hours"/></label>
        <label>Target quantity<input type="number" min="0" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></label>
        <label>Planned start<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>Planned finish<input type="date" min={start||undefined} value={finish} onChange={e=>setFinish(e.target.value)}/></label>
        <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <label className="pd-wide">Description<textarea rows={3} maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <div className="pd-wide pd-actions"><button className="pd-save" disabled={saving||!title.trim()}>{saving?'Saving…':'Add task'}</button></div>
      </form></section>
      <p className="pd-foot">Task updates are recorded with user, time and status history. Actual quantity remains independent of task status.</p>
    </>}
    <style jsx>{`
      .pd-shell{max-width:1200px;margin:auto;padding:25px 5% 60px;color:#182235}.pd-head{display:flex;justify-content:space-between;align-items:center;padding-bottom:18px;border-bottom:1px solid #e7eaf0}.pd-back{font-size:12px;color:#6558df;text-decoration:none}.pd-brand{font-weight:900;font-size:20px;margin-top:8px}.pd-brand span{color:#6558df}.pd-org-link{font-size:12px;color:#6558df;text-decoration:none}.pd-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:30px 0 20px}.pd-eyebrow{font-size:10px;letter-spacing:.13em;font-weight:850;color:#6558df}.pd-hero h1{font-size:34px;margin:8px 0}.pd-hero p,.pd-muted{color:#738097;font-size:13px}.pd-status,.pd-count{background:#f0efff;color:#5144c7;border-radius:99px;padding:7px 11px;font-size:11px;font-weight:800;text-transform:capitalize}.pd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0 18px}.pd-stats article,.pd-panel{border:1px solid #e7eaf0;background:#fff;border-radius:15px}.pd-stats article{padding:15px;display:grid;gap:7px}.pd-stats small{font-size:11px;color:#748096}.pd-stats strong{font-size:21px}.pd-panel{padding:20px;margin:16px 0}.pd-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.pd-title h2{margin:5px 0 0;font-size:21px}.pd-task-list{display:grid;gap:10px}.pd-package-list{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.pd-package{padding:7px 10px;border-radius:8px;background:#f4f3ff;color:#5144c7;font-size:11px;font-weight:750}.pd-task{display:grid;grid-template-columns:minmax(0,1fr) minmax(350px,1.15fr);gap:18px;border:1px solid #eceef3;border-radius:12px;padding:15px}.pd-task-info{min-width:0}.pd-task-info strong{font-size:15px}.pd-task-info small{display:block;color:#7a8497;font-size:11px;margin-top:6px}.pd-task-info p{font-size:12px;color:#68758b;margin:8px 0}.pd-task-edit{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start}.pd-task-edit label,.pd-form label{display:grid;gap:5px;font-size:11px;font-weight:750;color:#586276}.pd-task-edit input,.pd-task-edit select,.pd-form input,.pd-form select,.pd-form textarea{width:100%;min-width:0;border:1px solid #dfe3ec;border-radius:8px;padding:9px;font:inherit;color:#182235;background:#fff}.pd-task-edit input[readonly]{background:#f6f7fa;color:#7b8495}.pd-save{background:#5b46f6;color:white;border:0;border-radius:8px;padding:10px 14px;font-weight:800;cursor:pointer;align-self:end}.pd-save:disabled{opacity:.55}.pd-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.pd-wide{grid-column:1/-1}.pd-actions{display:flex;justify-content:flex-end}.pd-alert,.pd-notice{padding:11px 14px;border-radius:9px;font-size:13px}.pd-alert{background:#fff1f2;color:#be123c}.pd-notice{background:#ecfdf3;color:#047857}.pd-foot{text-align:center;color:#9299a8;font-size:11px;padding-top:12px}@media(max-width:760px){.pd-stats{grid-template-columns:repeat(2,1fr)}.pd-task{grid-template-columns:1fr}.pd-task-edit{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.pd-shell{padding:18px 4% 40px}.pd-hero h1{font-size:27px}.pd-head{align-items:flex-start}.pd-org-link{padding-top:8px}.pd-panel{padding:14px}.pd-form{grid-template-columns:1fr}.pd-wide{grid-column:auto}.pd-task-edit{grid-template-columns:1fr 1fr}}
    `}</style>
  </main>;
}
