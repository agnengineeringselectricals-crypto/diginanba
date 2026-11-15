'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type Organization = { id: string; name: string; role: string; project_count: number };
type Project = {
  id: string; organization_id: string; organization_name: string; project_code: string;
  name: string; description: string; project_type: string; client_name: string | null;
  currency_code: string; baseline_start_date: string | null; baseline_end_date: string | null;
  forecast_end_date: string | null; contract_value: string | null; approved_budget: string | null;
  status: string; progress_percent: number; task_count: number; completed_task_count: number;
};
const money = (value: string | null, currency: string) => value == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value));

export default function ProjectManagementPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [finishDate, setFinishDate] = useState('');
  const [budget, setBudget] = useState('');
  const [contract, setContract] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/project-management', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load projects.');
      setOrganizations(data.organizations || []);
      setProjects(data.projects || []);
      setOrganizationId((current: string) => current || data.organizations?.[0]?.id || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load projects.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedOrganization = useMemo(() => organizations.find(o => o.id === organizationId), [organizations, organizationId]);
  const visibleProjects = useMemo(() => organizationId ? projects.filter(p => p.organization_id === organizationId) : projects, [projects, organizationId]);

  async function createProject(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/project-management', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organizationId, name, description, clientName,
          baselineStartDate: startDate || null, baselineEndDate: finishDate || null,
          approvedBudget: budget ? Number(budget) : null, contractValue: contract ? Number(contract) : null,
          currencyCode: 'INR', projectType: 'engineering_construction',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create project.');
      setNotice(`Project ${data.project.project_code} created successfully.`);
      setName(''); setDescription(''); setClientName(''); setStartDate(''); setFinishDate(''); setBudget(''); setContract('');
      setShowCreate(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create project.'); }
    finally { setSaving(false); }
  }

  return <main className="pm-shell">
    <header className="pm-header">
      <div><Link href="/" className="pm-brand">DigiNanba <span>Projects</span></Link><p>Project delivery and organizational performance</p></div>
      <div className="pm-header-actions"><Link href="/project-management/portals" className="pm-secondary">Clients & Suppliers</Link><Link href="/project-management/team" className="pm-secondary">Team</Link><Link href="/organizations" className="pm-secondary">Organizations</Link><button className="pm-primary" onClick={() => setShowCreate(v => !v)} disabled={!organizations.length}>{showCreate ? 'Close form' : '+ New project'}</button></div>
    </header>
    <section className="pm-intro"><div><span className="pm-eyebrow">AGN ENGINEERING · WORKSPACE</span><h1>Plan clearly. Execute with control.</h1><p>Manage projects, people, commitments and performance in one connected workspace.</p></div><div className="pm-intro-mark">PM</div></section>
    {error && <p className="pm-alert" role="alert">{error}</p>}
    {notice && <p className="pm-notice" role="status">{notice}</p>}
    {showCreate && <section className="pm-panel pm-create"><div className="pm-section-title"><div><span className="pm-eyebrow">PROJECT SETUP</span><h2>Create a project</h2></div></div>
      <form onSubmit={createProject} className="pm-form">
        <label>Organization<select required value={organizationId} onChange={e => setOrganizationId(e.target.value)}>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label>Project name<input required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Factory electrical upgrade" /></label>
        <label>Client / customer<input value={clientName} onChange={e => setClientName(e.target.value)} maxLength={160} placeholder="Client or customer name" /></label>
        <label>Planned start<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label>Planned finish<input type="date" min={startDate || undefined} value={finishDate} onChange={e => setFinishDate(e.target.value)} /></label>
        <label>Contract value (INR)<input type="number" min="0" step="0.01" value={contract} onChange={e => setContract(e.target.value)} /></label>
        <label>Approved budget (INR)<input type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} /></label>
        <label className="pm-span">Project description<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} /></label>
        <div className="pm-span pm-form-actions"><button className="pm-primary" disabled={saving || !organizationId}>{saving ? 'Creating…' : 'Create project'}</button></div>
      </form>
    </section>}
    <section className="pm-stats">
      <article><span>Organizations</span><strong>{organizations.length}</strong><small>Accessible workspaces</small></article>
      <article><span>Projects</span><strong>{visibleProjects.length}</strong><small>In selected workspace</small></article>
      <article><span>Tasks recorded</span><strong>{visibleProjects.reduce((n,p) => n + p.task_count, 0)}</strong><small>Across selected projects</small></article>
      <article><span>Completed tasks</span><strong>{visibleProjects.reduce((n,p) => n + p.completed_task_count, 0)}</strong><small>Recorded as complete</small></article>
    </section>
    <section className="pm-panel">
      <div className="pm-section-title"><div><span className="pm-eyebrow">PORTFOLIO</span><h2>Projects</h2></div>
        <select aria-label="Filter by organization" value={organizationId} onChange={e => setOrganizationId(e.target.value)}><option value="">All organizations</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      </div>
      {loading ? <p className="pm-muted">Loading your workspace…</p> : !organizations.length ? <div className="pm-empty"><h3>Create your first organization workspace</h3><p>Project Management uses DigiNanba organization workspaces and membership access.</p><Link href="/organizations" className="pm-primary">Set up organization</Link></div> : !visibleProjects.length ? <div className="pm-empty"><h3>No projects in this workspace yet</h3><p>Create a project to start recording scope, dates, budgets, tasks and delivery performance.</p><button className="pm-primary" onClick={() => setShowCreate(true)}>Create first project</button></div> :
      <div className="pm-project-grid">{visibleProjects.map(project => <article className="pm-project-card" key={project.id}>
        <div className="pm-project-top"><span className="pm-code">{project.project_code}</span><span className={`pm-status pm-status-${project.status}`}>{project.status.replaceAll('_',' ')}</span></div>
        <h3><Link href={`/project-management/${project.id}`} className="pm-project-link">{project.name}</Link></h3><p className="pm-client">{project.organization_name}{project.client_name ? ` · ${project.client_name}` : ''}</p>
        <div className="pm-progress"><span style={{ width: `${Math.max(0,Math.min(100,Number(project.progress_percent)||0))}%` }} /></div>
        <div className="pm-progress-label"><span>{Number(project.progress_percent)||0}% reported progress</span><span>{project.completed_task_count}/{project.task_count} tasks</span></div>
        <div className="pm-project-meta"><span>Budget <b>{money(project.approved_budget, project.currency_code)}</b></span><span>Finish <b>{project.baseline_end_date ? new Date(project.baseline_end_date).toLocaleDateString() : 'Not set'}</b></span></div>
        <p className="pm-muted">{project.description || 'No project description added.'}</p>
      </article>)}</div>}
    </section>
    <section className="pm-module-grid"><article><span>01</span><h3>Work breakdown & tasks</h3><p>Structure project scope, owners, dependencies and delivery dates.</p></article><article><span>02</span><h3>Performance ledger</h3><p>Record target, actual, status, variance, reasons and corrective action.</p></article><article><span>03</span><h3>People & resources</h3><p>Connect departments, designations, roles and project assignments.</p></article><article><span>04</span><h3>Commercial control</h3><p>Prepare budgets, procurement, quotations and financial tracking.</p></article></section>
    <footer className="pm-footer">DigiNanba Project Management · Organization-scoped access · All changes are recorded for audit</footer>
    <style jsx>{`
      .pm-shell{max-width:1320px;margin:auto;padding:28px 5% 60px;color:#172033}.pm-header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:8px 0 24px;border-bottom:1px solid #e7eaf1}.pm-brand{font-size:22px;font-weight:900;color:#172033}.pm-brand span{color:#5b46f6}.pm-header p{margin:5px 0 0;color:#718096;font-size:13px}.pm-header-actions{display:flex;gap:10px;align-items:center}.pm-primary,.pm-secondary{border:1px solid #5b46f6;border-radius:10px;padding:11px 15px;font-weight:750;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.pm-primary{background:#5b46f6;color:#fff}.pm-primary:disabled{opacity:.5;cursor:not-allowed}.pm-secondary{background:#fff;color:#4033c9;border-color:#dedaff}.pm-intro{display:flex;justify-content:space-between;align-items:center;padding:36px 0 24px}.pm-eyebrow{font-size:11px;font-weight:850;letter-spacing:.12em;color:#6558df}.pm-intro h1{font-size:38px;letter-spacing:-1.3px;margin:9px 0}.pm-intro p{color:#68738a;margin:0;max-width:620px}.pm-intro-mark{width:90px;height:90px;border-radius:24px;background:linear-gradient(135deg,#5b46f6,#9288ff);display:grid;place-items:center;color:#fff;font-size:30px;font-weight:900;box-shadow:0 12px 30px #5b46f633}.pm-alert,.pm-notice{padding:12px 14px;border-radius:10px}.pm-alert{background:#fff1f2;color:#be123c}.pm-notice{background:#ecfdf3;color:#047857}.pm-panel{background:#fff;border:1px solid #e7eaf1;border-radius:17px;padding:22px;margin:18px 0}.pm-section-title{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:18px}.pm-section-title h2{margin:5px 0 0;font-size:23px}.pm-section-title select,.pm-form input,.pm-form select,.pm-form textarea{border:1px solid #dfe3ec;border-radius:9px;padding:11px;background:#fff;color:#172033;font:inherit;min-width:0}.pm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pm-form label{display:grid;gap:6px;font-size:13px;font-weight:700;color:#4b5563}.pm-span{grid-column:1/-1}.pm-form-actions{display:flex;justify-content:flex-end}.pm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin:17px 0}.pm-stats article{background:#fff;border:1px solid #e7eaf1;border-radius:14px;padding:17px;display:grid;gap:5px}.pm-stats span,.pm-stats small{font-size:12px;color:#758096}.pm-stats strong{font-size:27px}.pm-muted{color:#758096;font-size:13px;line-height:1.5}.pm-empty{text-align:center;padding:32px 15px}.pm-empty h3{margin:0 0 7px}.pm-empty p{color:#758096;margin:0 0 18px}.pm-project-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pm-project-card{border:1px solid #e8eaf1;border-radius:13px;padding:17px;min-width:0}.pm-project-top{display:flex;justify-content:space-between;gap:10px}.pm-code{font-size:11px;font-weight:800;color:#6558df}.pm-status{font-size:10px;text-transform:capitalize;border-radius:99px;padding:5px 8px;background:#f1f3f7;color:#596273}.pm-status-active{background:#ecfdf3;color:#047857}.pm-project-card h3{margin:12px 0 4px;font-size:18px}.pm-project-link{color:inherit;text-decoration:none}.pm-project-link:hover{color:#5b46f6;text-decoration:underline}.pm-client{margin:0;color:#718096;font-size:12px}.pm-progress{height:7px;border-radius:99px;background:#edf0f5;margin:17px 0 6px;overflow:hidden}.pm-progress span{height:100%;display:block;background:#6255e7;border-radius:99px}.pm-progress-label,.pm-project-meta{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#758096}.pm-project-meta{padding:13px 0;border-top:1px solid #edf0f5;margin-top:13px}.pm-project-meta b{display:block;color:#273247;margin-top:4px;font-size:12px}.pm-project-card .pm-muted{margin:3px 0 0}.pm-module-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.pm-module-grid article{padding:17px;border:1px solid #e7eaf1;border-radius:14px;background:#fff}.pm-module-grid article>span{font-size:11px;color:#6558df;font-weight:900}.pm-module-grid h3{font-size:15px;margin:9px 0 6px}.pm-module-grid p{font-size:12px;color:#758096;line-height:1.5;margin:0}.pm-footer{text-align:center;color:#9299a8;font-size:11px;padding:30px 0 0}@media(max-width:800px){.pm-stats{grid-template-columns:repeat(2,1fr)}.pm-module-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.pm-shell{padding:18px 4% 40px}.pm-header{align-items:flex-start;flex-direction:column}.pm-header-actions{width:100%}.pm-header-actions>*{flex:1}.pm-intro h1{font-size:30px}.pm-intro-mark{width:65px;height:65px;font-size:22px}.pm-form,.pm-project-grid{grid-template-columns:1fr}.pm-span{grid-column:auto}.pm-section-title{align-items:flex-start;flex-direction:column}.pm-stats{gap:8px}.pm-stats article{padding:13px}.pm-stats strong{font-size:23px}.pm-module-grid{grid-template-columns:1fr 1fr}}
    `}</style>
  </main>;
}
