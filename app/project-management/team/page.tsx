'use client';

import Link from 'next/link';
import { useCallback,useEffect,useState,type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

type Org={id:string;name:string;role:string};
type Member={membership_id:string;status:string;employee_code:string|null;employment_type:string;joined_at:string|null;user_id:string;display_name:string|null;email:string;role_code:string|null;role_name:string|null;department_name:string|null;designation_name:string|null};
type Department={id:string;name:string};

export default function ProjectTeamPage(){
  const search=useSearchParams();
  const acceptId=search.get('accept')||'';
  const [orgs,setOrgs]=useState<Org[]>([]);
  const [orgId,setOrgId]=useState('');
  const [members,setMembers]=useState<Member[]>([]);
  const [departments,setDepartments]=useState<Department[]>([]);
  const [email,setEmail]=useState('');
  const [role,setRole]=useState('engineer');
  const [departmentId,setDepartmentId]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/project-management',{cache:'no-store'});const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Sign in to access your organization.');
      const allowed=(d.organizations||[]).filter((o:Org)=>['owner','admin'].includes(o.role));
      setOrgs(allowed);const selected=orgId&&allowed.some((o:Org)=>o.id===orgId)?orgId:allowed[0]?.id||'';setOrgId(selected);
      if(selected){
        const tr=await fetch('/api/project-management/team?organizationId='+selected,{cache:'no-store'});const td=await tr.json();
        if(!tr.ok)throw new Error(td.error||'Unable to load team.');
        setMembers(td.members||[]);setDepartments(td.departments||[]);
      }else{setMembers([]);setDepartments([]);}
    }catch(e){setError(e instanceof Error?e.message:'Unable to load team.')}
    finally{setLoading(false)}
  },[orgId]);

  useEffect(()=>{
    let cancelled=false;
    async function run(){
      if(acceptId){
        setLoading(true);setError('');setNotice('');
        try{
          const r=await fetch('/api/project-management/team/accept',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:acceptId})});
          const d=await r.json();if(!r.ok)throw new Error(r.status===401?'Sign in first, then reopen this invitation link.':d.error||'Could not accept invitation.');
          if(!cancelled)setNotice(d.message||'Invitation accepted.');
        }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not accept invitation.');}
        finally{if(!cancelled)setLoading(false)}
      }
      if(!cancelled)await load();
    }
    void run();return()=>{cancelled=true};
  },[acceptId,load]);

  async function invite(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');setNotice('');
    try{
      const r=await fetch('/api/project-management/team',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:orgId,email,roleCode:role,departmentId:departmentId||null})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not invite team member.');
      setNotice(d.message);setEmail('');await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not invite team member.')}
    finally{setSaving(false)}
  }

  return <main className="pt-shell">
    <header className="pt-head"><div><Link href="/project-management" className="pt-back">← Project Management</Link><h1>Team & access</h1><p>Invite your AGN colleagues and assign the right workspace role.</p></div><Link href="/organizations" className="pt-org">Organizations</Link></header>
    {error&&<p className="pt-alert" role="alert">{error}{error.includes('Sign in first')&&<> <Link href={'/login?callbackUrl='+encodeURIComponent('/project-management/team?accept='+acceptId)}>Sign in</Link></>}</p>}
    {notice&&<p className="pt-notice" role="status">{notice}</p>}
    {!acceptId&&<><section className="pt-panel"><div className="pt-title"><div><span className="pt-eyebrow">ORGANIZATION</span><h2>Choose workspace</h2></div></div>
      {orgs.length>0?<select value={orgId} onChange={e=>setOrgId(e.target.value)}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>:<p className="pt-muted">Only organization owners and admins can invite or manage members. If you are an invited engineer, open the invitation link sent to your email.</p>}
    </section>
    {orgId&&<section className="pt-panel"><div className="pt-title"><div><span className="pt-eyebrow">ONBOARDING</span><h2>Invite an engineer or colleague</h2></div></div>
      <p className="pt-muted">The person must first register a DigiNanba account using the email address you enter. The invitation then connects that account to this organization without creating a duplicate login.</p>
      <form className="pt-form" onSubmit={invite}>
        <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="engineer@example.com"/></label>
        <label>Project Management role<select value={role} onChange={e=>setRole(e.target.value)}><option value="engineer">Engineer</option><option value="project_manager">Project Manager</option><option value="viewer">Read-only Viewer</option></select></label>
        <label>Department<select value={departmentId} onChange={e=>setDepartmentId(e.target.value)}><option value="">Not assigned yet</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <div className="pt-actions"><button disabled={saving||!orgId}>{saving?'Sending invitation…':'Invite team member'}</button></div>
      </form>
    </section>
    <section className="pt-panel"><div className="pt-title"><div><span className="pt-eyebrow">PEOPLE</span><h2>Organization team</h2></div><span className="pt-count">{members.length} members</span></div>
      {loading?<p className="pt-muted">Loading team…</p>:members.length===0?<p className="pt-muted">No Project Management members yet. Invite your first engineer to begin.</p>:<div className="pt-table"><div className="pt-row pt-th"><span>Person</span><span>Role</span><span>Department</span><span>Status</span></div>{members.map(m=><div className="pt-row" key={m.membership_id}><span><b>{m.display_name||m.email}</b><small>{m.email}</small></span><span>{m.role_name||m.role_code||'Not assigned'}</span><span>{m.department_name||'—'}</span><span><i className={'pt-pill pt-'+m.status}>{m.status}</i></span></div>)}</div>}
    </section></>}
    </>}
    <footer className="pt-foot">Organization access is separate from project assignment. A team member only sees projects they are allowed to access.</footer>
    <style jsx>{`
      .pt-shell{max-width:1100px;margin:auto;padding:26px 5% 60px;color:#182235}.pt-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e7eaf0;padding-bottom:20px}.pt-back{font-size:12px;color:#6558df;text-decoration:none}.pt-head h1{font-size:30px;margin:8px 0 4px}.pt-head p,.pt-muted{font-size:13px;color:#758096}.pt-org{color:#6558df;font-size:12px;text-decoration:none}.pt-panel{background:white;border:1px solid #e7eaf0;border-radius:15px;padding:20px;margin:17px 0}.pt-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.pt-title h2{font-size:20px;margin:5px 0}.pt-eyebrow{font-size:10px;letter-spacing:.13em;font-weight:850;color:#6558df}.pt-panel select,.pt-form input,.pt-form select{border:1px solid #dfe3ec;border-radius:9px;padding:11px;background:white;color:#182235;font:inherit;min-width:0}.pt-form{display:grid;grid-template-columns:2fr 1fr 1fr;gap:13px}.pt-form label{display:grid;gap:6px;font-size:12px;font-weight:750;color:#596477}.pt-actions{display:flex;align-items:end}.pt-actions button{background:#5b46f6;color:white;border:0;border-radius:9px;padding:12px 16px;font-weight:800;cursor:pointer}.pt-actions button:disabled{opacity:.5}.pt-alert,.pt-notice{padding:12px 14px;border-radius:9px;font-size:13px}.pt-alert{background:#fff1f2;color:#be123c}.pt-notice{background:#ecfdf3;color:#047857}.pt-count{background:#f1efff;color:#5144c7;padding:6px 9px;border-radius:99px;font-size:11px;font-weight:800}.pt-table{display:grid}.pt-row{display:grid;grid-template-columns:2fr 1fr 1fr 100px;gap:12px;padding:12px 6px;border-top:1px solid #edf0f5;align-items:center;font-size:12px}.pt-row small{display:block;color:#7b8496;margin-top:4px}.pt-th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#8a93a4;font-weight:800;border-top:0}.pt-pill{font-style:normal;font-size:10px;padding:5px 8px;border-radius:99px;background:#f2f4f7;color:#626d80}.pt-active{background:#e9f9ef;color:#087b49}.pt-invited{background:#fff7e6;color:#9a6500}.pt-foot{text-align:center;color:#919aaa;font-size:11px;padding-top:20px}@media(max-width:760px){.pt-form{grid-template-columns:1fr 1fr}.pt-actions{grid-column:1/-1}.pt-row{grid-template-columns:1.5fr 1fr 90px}.pt-row span:nth-child(3){display:none}}@media(max-width:520px){.pt-shell{padding:18px 4% 40px}.pt-head h1{font-size:26px}.pt-form{grid-template-columns:1fr}.pt-actions{grid-column:auto}.pt-row{grid-template-columns:1fr 90px}.pt-row span:nth-child(2){display:none}}
    `}</style>
  </main>;
}
