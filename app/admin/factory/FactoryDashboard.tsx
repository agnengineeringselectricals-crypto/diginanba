'use client';

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';

type Overview={
  counts:{status:string;count:number}[];
  runs:{id:string;agent_type:string;status:string;started_at:string;completed_at:string|null;job_count:number}[];
  opportunities:{id:string;market_code:string;title:string;opportunity_score:number|null;priority:string;confidence_score:number;status:string;created_at:string;source_summary:string|null;evidence_json:unknown;source_references_json:{url?:string;source?:string;summary?:string;type?:string}[];provenance_json:unknown}[];
  jobs:{id:string;job_type:string;status:string;cost_class:string;retry_count:number;error_code:string|null;error_message:string|null;created_at:string}[];
  events:{id:string;agent_run_id:string;event_type:string;level:string;message:string;data_json:unknown;created_at:string}[];
  productJobs:{id:string;opportunity_id:string;product_id:string|null;job_type:string;status:string;brief_version:number;error_message:string|null;created_at:string}[];
  assets:{id:string;product_job_id:string;product_id:string|null;asset_type:string;file_name:string;mime_type:string;version:number;status:string;size_bytes:number|null;checksum_sha256:string|null;created_at:string}[];
  qualityChecks:{id:string;product_id:string|null;product_job_id:string|null;check_type:string;status:string;score:number|null;findings_json:unknown;checked_at:string}[];
  publishing:{id:string;product_id:string;product_edition_id:string|null;market_code:string;locale:string;status:string;approval_required:boolean;approved_by:string|null;approved_at:string|null;published_at:string|null;error_message:string|null;created_at:string}[];
  growth:{kind:string;status:string;count:number}[];
  approvals:{id:string;approval_type:string;status:string;requested_at:string;request_json:Record<string,unknown>;job_type:string}[];
  financialPolicy:{max_spend_minor:string;currency_code:string;paid_actions_allowed:boolean;owner_approval_required:boolean;unknown_cost_action:string}|null;
  categories:{slug:string;name:string}[];
  schedules:{id:string;agent_type:string;schedule_expression:string;timezone:string;enabled:boolean;last_run_at:string|null;next_run_at:string|null}[];
  capabilities:{agent:string;status:string;scope:string}[];
};

const card:CSSProperties={background:'#fff',border:'1px solid #e4e9f0',borderRadius:16,padding:20,minWidth:0};
const label:CSSProperties={color:'#64748b',fontSize:13,marginBottom:8};

export default function FactoryDashboard(){
  const [data,setData]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [market,setMarket]=useState('US');
  const [title,setTitle]=useState('');
  const [problem,setProblem]=useState('');
  const [summary,setSummary]=useState('');
  const [sourceOne,setSourceOne]=useState('');
  const [sourceTwo,setSourceTwo]=useState('');
  const [sourceThree,setSourceThree]=useState('');
  const [sourceSummaryOne,setSourceSummaryOne]=useState('');
  const [sourceSummaryTwo,setSourceSummaryTwo]=useState('');
  const [sourceSummaryThree,setSourceSummaryThree]=useState('');
  const [categorySlug,setCategorySlug]=useState('');

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{const response=await fetch('/api/admin/factory',{cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to load factory dashboard.');setData(body);}
    catch(e){setError(e instanceof Error?e.message:'Unable to load factory dashboard.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);

  async function submitJob(body:Record<string,unknown>){
    setWorking(true);setError('');setNotice('');
    try{
      let response=await fetch('/api/admin/factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,idempotencyKey:crypto.randomUUID()})});
      let result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to start factory run.');
      let run=result.run;
      for(let i=0;run?.status==='running'&&i<20;i++){
        response=await fetch(`/api/admin/factory/runs/${run.id}/resume`,{method:'POST'});
        result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to continue factory run.');run=result.run;
      }
      setNotice(run?.status==='running'?'Run is still queued; use Continue queued run below.':`Run ${run?.status??'accepted'}; ${run?.completed_jobs??0} jobs completed, ${run?.blocked_jobs??0} blocked, ${run?.provider_required_jobs??0} provider-required, ${run?.approval_required_jobs??0} awaiting approval.`);
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Factory operation failed.');}
    finally{setWorking(false);}
  }

  async function handleEvidence(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    await submitJob({action:'score_opportunity',marketCode:market,title,problemStatement:problem,sourceSummary:summary,categorySlug:categorySlug||undefined,sources:[{url:sourceOne,summary:sourceSummaryOne},{url:sourceTwo,summary:sourceSummaryTwo},{url:sourceThree,summary:sourceSummaryThree}]});
    setTitle('');setProblem('');setSummary('');setSourceOne('');setSourceTwo('');setSourceThree('');setSourceSummaryOne('');setSourceSummaryTwo('');setSourceSummaryThree('');
  }

  async function continueRun(runId:string){
    setWorking(true);setError('');setNotice('');
    try{
      let run:Overview['runs'][number]|null=null;
      for(let i=0;i<20;i++){
        const response=await fetch(`/api/admin/factory/runs/${runId}/resume`,{method:'POST'});const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to continue this run.');run=body.run;if(run?.status!=='running')break;
      }
      setNotice(run?.status==='running'?'Run remains queued for a later continuation.':`Run ${run?.status??'updated'}.`);await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Unable to continue this run.');}
    finally{setWorking(false);}
  }

  async function processDueSchedules(){
    setWorking(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/admin/factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'run_due_schedules',idempotencyKey:crypto.randomUUID()})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to process due schedules.');
      setNotice(`${body.scheduleResult?.dueCount??0} enabled schedules were due and processed.`);await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Unable to process due schedules.');}
    finally{setWorking(false);}
  }

  const counts=new Map((data?.counts??[]).map((item)=>[item.status,item.count]));
  return <main className="page" style={{maxWidth:1240,margin:'0 auto',padding:'32px 20px 64px',width:'100%',boxSizing:'border-box'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap',marginBottom:24}}>
      <div><span className="eyebrow">PRIVATE OPERATIONS</span><h1 style={{margin:'8px 0'}}>Autonomous Factory</h1><p style={{margin:0,color:'#526174'}}>Durable, policy-checked product and growth workflows. Execution starts only on an authorized admin action.</p></div>
      <button className="primary" disabled={working||loading} onClick={()=>void submitJob({action:'catalog_research'})}>{working?'Working…':'Scan catalog coverage'}</button>
    </header>
    {error&&<div role="alert" style={{...card,borderColor:'#fecaca',color:'#991b1b',marginBottom:16}}>{error}</div>}
    {notice&&<div role="status" style={{...card,borderColor:'#bbf7d0',color:'#166534',marginBottom:16}}>{notice}</div>}
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,170px),1fr))',gap:12,marginBottom:22}}>
      {['queued','running','completed','failed','blocked','provider_required','approval_required'].map((status)=><div key={status} style={card}><div style={label}>{status.replaceAll('_',' ')}</div><strong style={{fontSize:26}}>{loading?'—':counts.get(status)??0}</strong></div>)}
    </section>
    <section style={{...card,marginBottom:22}}>
      <h2 style={{marginTop:0}}>Financial safety</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))',gap:16}}>
        <div><div style={label}>Autonomous spending</div><strong>₹0</strong></div>
        <div><div style={label}>Paid resources</div><strong>Blocked</strong></div>
        <div><div style={label}>Unknown cost</div><strong>Blocked</strong></div>
        <div><div style={label}>External communications</div><strong>Authorization required</strong></div>
        <div><div style={label}>Policy record</div><strong>{data?.financialPolicy?'Active':'Unavailable'}</strong></div>
      </div>
      <p style={{color:'#64748b',marginBottom:0}}>No credentials are stored here. No external account, paid provider, or marketing integration is activated.</p>
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:18,marginBottom:22}}>
      <div style={card}>
        <h2 style={{marginTop:0}}>Agents and provider status</h2>
        <div style={{display:'grid',gap:12}}>{data?.capabilities.map((item)=><div key={item.agent} style={{borderTop:'1px solid #edf0f4',paddingTop:10}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>{item.agent}</strong><span style={{fontSize:12,fontWeight:700,color:item.status==='EXECUTABLE_FREE'?'#166534':'#9a3412'}}>{item.status.replaceAll('_',' ')}</span></div><div style={{fontSize:13,color:'#64748b',marginTop:3}}>{item.scope}</div></div>)}</div>
      </div>
      <div style={card}>
        <h2 style={{marginTop:0}}>Score cited opportunity</h2>
        <p style={{color:'#64748b'}}>Submit public references you reviewed. The system records the URLs but does not scrape or fetch them. Private/internal evidence stays in this admin view.</p>
        <form onSubmit={handleEvidence} style={{display:'grid',gap:10}}>
          <label>Market<select value={market} onChange={(e)=>setMarket(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:4}}><option value="US">United States</option><option value="UK">United Kingdom</option></select></label>
          <label>Category<select value={categorySlug} onChange={(e)=>setCategorySlug(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:4}}><option value="">Select if known</option>{data?.categories.map((category)=><option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>
          <label>Opportunity title<input required minLength={8} maxLength={180} value={title} onChange={(e)=>setTitle(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:4}} /></label>
          <label>Customer problem<textarea required minLength={20} maxLength={2000} value={problem} onChange={(e)=>setProblem(e.target.value)} rows={3} style={{display:'block',width:'100%',padding:10,marginTop:4,resize:'vertical'}} /></label>
          <label>Evidence summary<textarea required minLength={20} maxLength={1200} value={summary} onChange={(e)=>setSummary(e.target.value)} rows={2} style={{display:'block',width:'100%',padding:10,marginTop:4,resize:'vertical'}} /></label>
          <label>Public HTTPS source URL 1<input required type="url" value={sourceOne} onChange={(e)=>setSourceOne(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:4}} /></label>
          <label>Source 1 evidence summary<textarea required minLength={10} maxLength={1000} value={sourceSummaryOne} onChange={(e)=>setSourceSummaryOne(e.target.value)} rows={2} style={{display:'block',width:'100%',padding:10,marginTop:4,resize:'vertical'}} /></label>
          <label>Public HTTPS source URL 2<input required type="url" value={sourceTwo} onChange={(e)=>setSourceTwo(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:4}} /></label>
          <label>Source 2 evidence summary<textarea required minLength={10} maxLength={1000} value={sourceSummaryTwo} onChange={(e)=>setSourceSummaryTwo(e.target.value)} rows={2} style={{display:'block',width:'100%',padding:10,marginTop:4,resize:'vertical'}} /></label>
          <label>Public HTTPS source URL 3<input required type="url" value={sourceThree} onChange={(e)=>setSourceThree(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:4}} /></label>
          <label>Source 3 evidence summary<textarea required minLength={10} maxLength={1000} value={sourceSummaryThree} onChange={(e)=>setSourceSummaryThree(e.target.value)} rows={2} style={{display:'block',width:'100%',padding:10,marginTop:4,resize:'vertical'}} /></label>
          <button className="primary" disabled={working}>{working?'Scoring…':'Create and score opportunity'}</button>
        </form>
      </div>
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,350px),1fr))',gap:18,marginBottom:22}}>
      <div style={card}><h2 style={{marginTop:0}}>Research opportunities</h2>{data?.opportunities.length?data.opportunities.map((item)=><article key={item.id} style={{borderTop:'1px solid #edf0f4',padding:'12px 0'}}><strong>{item.title}</strong><div style={{color:'#64748b',fontSize:13,marginTop:4}}>{item.market_code} · {item.priority} · score {item.opportunity_score??'—'} · confidence {Math.round(Number(item.confidence_score)*100)}%</div><p style={{margin:'6px 0',fontSize:13,color:'#475569'}}>{item.source_summary}</p><details><summary>Evidence and provenance</summary><ul style={{fontSize:13,paddingLeft:20}}>{item.source_references_json?.map((ref,index)=><li key={`${item.id}-${index}`}>{ref.url?<a href={ref.url} target="_blank" rel="noreferrer">{ref.source??ref.url}</a>:ref.source??ref.type??'Internal evidence'}{ref.summary?` — ${ref.summary}`:''}</li>)}</ul></details></article>):<p style={{color:'#64748b'}}>No opportunities recorded yet.</p>}</div>
      <div style={card}><h2 style={{marginTop:0}}>Runs</h2>{data?.runs.length?data.runs.map((run)=><article key={run.id} style={{borderTop:'1px solid #edf0f4',padding:'12px 0',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><strong>{run.agent_type.replaceAll('_',' ')}</strong><div style={{color:'#64748b',fontSize:13}}>{run.status} · {run.job_count} jobs · {run.id.slice(0,8)}</div></div>{run.status==='running'&&<button disabled={working} onClick={()=>void continueRun(run.id)}>Continue queued run</button>}</article>):<p style={{color:'#64748b'}}>No runs started yet.</p>}</div>
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,330px),1fr))',gap:18,marginBottom:22}}>
      <div style={card}><h2 style={{marginTop:0}}>Product jobs and assets</h2>{data?.productJobs.length?data.productJobs.map((job)=><article key={job.id} style={{padding:'10px 0',borderTop:'1px solid #edf0f4'}}><strong>{job.job_type.replaceAll('_',' ')}</strong><div style={{fontSize:13,color:'#64748b'}}>{job.status} · v{job.brief_version} · {job.product_id?'product draft created':'brief only'}</div>{job.error_message&&<p style={{fontSize:13,color:'#991b1b'}}>{job.error_message}</p>}</article>):<p style={{color:'#64748b'}}>No product jobs generated yet.</p>}{data?.assets.map((asset)=><div key={asset.id} style={{fontSize:13,padding:'7px 0',borderTop:'1px solid #edf0f4'}}><strong>{asset.file_name}</strong> · {asset.status} · {asset.size_bytes??0} bytes · v{asset.version}</div>)}</div>
      <div style={card}><h2 style={{marginTop:0}}>Quality and publishing</h2>{data?.qualityChecks.length?data.qualityChecks.map((check)=><div key={check.id} style={{padding:'9px 0',borderTop:'1px solid #edf0f4',fontSize:13}}><strong>{check.check_type.replaceAll('_',' ')}</strong> · {check.status} · {check.score??'—'}</div>):<p style={{color:'#64748b'}}>No QA results yet.</p>}{data?.publishing.map((item)=><div key={item.id} style={{padding:'9px 0',borderTop:'1px solid #edf0f4',fontSize:13}}><strong>{item.market_code} / {item.locale}</strong> · {item.status}{item.error_message&&<div style={{color:'#64748b'}}>{item.error_message}</div>}</div>)}</div>
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,330px),1fr))',gap:18,marginBottom:22}}>
      <div style={card}><h2 style={{marginTop:0}}>Marketing & growth</h2>{data?.growth.length?data.growth.map((item)=><div key={`${item.kind}-${item.status}`} style={{padding:'8px 0',borderTop:'1px solid #edf0f4'}}><strong>{item.kind.replaceAll('_',' ')}</strong> · {item.status} · {item.count}</div>):<p style={{color:'#64748b'}}>No strategy or campaign drafts created.</p>}<p style={{fontSize:13,color:'#64748b'}}>Private organic strategy and content drafts only. External posting and paid campaigns remain blocked.</p></div>
      <div style={card}><h2 style={{marginTop:0}}>Recent agent events</h2>{data?.events.length?data.events.slice(0,12).map((event)=><div key={event.id} style={{padding:'8px 0',borderTop:'1px solid #edf0f4',fontSize:13}}><strong>{event.event_type.replaceAll('_',' ')}</strong><div style={{color:'#64748b'}}>{event.message}</div></div>):<p style={{color:'#64748b'}}>No events recorded yet.</p>}</div>
    </section>
    <section style={{...card,marginBottom:22}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 5px'}}>Scheduling</h2><p style={{margin:0,color:'#64748b'}}>No background schedules are active. Due UTC internal research schedules can be processed manually; minimum supported interval is hourly.</p></div><button disabled={working||!data?.schedules.some((schedule)=>schedule.enabled&&schedule.next_run_at&&new Date(schedule.next_run_at)<=new Date())} onClick={()=>void processDueSchedules()}>Process due schedules</button></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:10,marginTop:14}}>{data?.schedules.map((schedule)=><div key={schedule.id} style={{borderTop:'1px solid #edf0f4',paddingTop:10}}><strong>{schedule.agent_type.replaceAll('_',' ')}</strong><div style={{fontSize:13,color:'#64748b'}}>{schedule.schedule_expression} · {schedule.timezone} · {schedule.enabled?'enabled':'disabled'}</div></div>)}</div>
    </section>
    <section style={{...card,marginBottom:22}}><h2 style={{marginTop:0}}>Approval-required work</h2>{data?.approvals.length?data.approvals.map((approval)=><div key={approval.id} style={{padding:'10px 0',borderTop:'1px solid #edf0f4'}}><strong>{approval.approval_type.replaceAll('_',' ')}</strong><span style={{color:'#64748b'}}> · {approval.job_type.replaceAll('_',' ')}</span><p style={{fontSize:13,color:'#64748b',margin:'5px 0'}}>Public publishing remains held until a market edition and reviewed price are prepared. No item is published automatically.</p></div>):<p style={{color:'#64748b'}}>No approval requests currently pending.</p>}</section>
    <section style={card}><h2 style={{marginTop:0}}>Recent jobs</h2><div style={{overflowX:'auto',maxWidth:'100%'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:540}}><thead><tr>{['Agent job','Status','Cost','Retries','Details'].map((header)=><th key={header} style={{textAlign:'left',padding:9,borderBottom:'1px solid #e4e9f0'}}>{header}</th>)}</tr></thead><tbody>{data?.jobs.map((job)=><tr key={job.id}><td style={{padding:9,borderBottom:'1px solid #edf0f4'}}>{job.job_type.replaceAll('_',' ')}</td><td style={{padding:9,borderBottom:'1px solid #edf0f4'}}>{job.status.replaceAll('_',' ')}</td><td style={{padding:9,borderBottom:'1px solid #edf0f4'}}>{job.cost_class}</td><td style={{padding:9,borderBottom:'1px solid #edf0f4'}}>{job.retry_count}</td><td style={{padding:9,borderBottom:'1px solid #edf0f4',maxWidth:260,overflowWrap:'anywhere'}}>{job.error_message??job.error_code??'—'}</td></tr>)}</tbody></table></div><button style={{marginTop:12}} onClick={()=>void refresh()} disabled={loading}>Refresh status</button></section>
  </main>;
}
