import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { assignTeamMembership } from './actions';

const departments = [
  { code: 'accounts-security', name: 'Accounts & Security', desc: 'Account administration, permissions, security and compliance' },
  { code: 'customer-care', name: 'Customer Care', desc: 'Customer queries, complaints, service quality and escalations' },
  { code: 'products-catalog', name: 'Products & Catalog', desc: 'Product review, categories, listing quality and publishing' },
  { code: 'users-creators', name: 'Users & Creators', desc: 'User support, creator onboarding and creator operations' },
  { code: 'ai-product-factory', name: 'AI Product Factory', desc: 'Demand research, product creation, quality review and localization' },
  { code: 'finance-payments', name: 'Finance & Payments', desc: 'Orders, payment reconciliation, settlements and finance reports' },
  { code: 'marketing-growth', name: 'Marketing & Growth', desc: 'SEO, campaigns, partnerships, acquisition and retention' },
  { code: 'localization-markets', name: 'Localization & Markets', desc: 'Countries, languages, currencies and local market readiness' },
];
const levels = [
  { n: '01', title: 'Chief / Super Admin', desc: 'Platform-wide authority, governance, role approvals and oversight of all departments.' },
  { n: '02', title: 'Department Sub-Admin', desc: 'Runs one assigned department, assigns team leaders and reviews departmental performance.' },
  { n: '03', title: 'Team Leader', desc: 'Assigns work to staff, tracks delivery and quality, and escalates issues to the department sub-admin.' },
  { n: '04', title: 'Staff', desc: 'Accesses assigned tasks and only the information/actions needed for the assigned duties.' },
];

export default async function AdminTeamPage() {
  const session = await auth();
  if (!session?.user) redirect('/admin/login');
  const roleResult = await db.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     WHERE ur.user_id=$1 AND r.name IN ('Super Admin','Operations Admin') ORDER BY CASE WHEN r.name='Super Admin' THEN 0 ELSE 1 END`,
    [session.user.id],
  );
  if (!roleResult.rowCount) redirect('/account');

  let dbReady = true;
  let deptRows: { code: string; name: string; status: string; teams: number; team_names: string | null; members: number; leaders: number }[] = [];
  let hierarchyCounts = { chief: 0, subAdmins: 0, leaders: 0, staff: 0, invited: 0 };
  try {
    const [deptResult, memberResult] = await Promise.all([
      db.query(`SELECT d.code,d.name,COALESCE(to_jsonb(d)->>'status','active') AS status,COUNT(DISTINCT t.id)::int AS teams,STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) AS team_names,
        COUNT(DISTINCT CASE WHEN m.status='active' THEN m.id END)::int AS members,
        COUNT(DISTINCT CASE WHEN m.status='active' AND m.role_code='team_leader' THEN m.id END)::int AS leaders
        FROM admin_departments d LEFT JOIN admin_teams t ON t.department_id=d.id
        LEFT JOIN admin_staff_memberships m ON m.department_id=d.id
        GROUP BY d.id ORDER BY d.name`),
      db.query(`SELECT role_code,status,COUNT(*)::int AS n FROM admin_staff_memberships GROUP BY role_code,status`),
    ]);
    deptRows = deptResult.rows;
    for (const r of memberResult.rows as {role_code:string;status:string;n:number}[]) {
      const n = Number(r.n);
      if (r.role_code==='chief_admin' && r.status==='active') hierarchyCounts.chief += n;
      if (r.role_code==='sub_admin' && r.status==='active') hierarchyCounts.subAdmins += n;
      if (r.role_code==='team_leader' && r.status==='active') hierarchyCounts.leaders += n;
      if (r.role_code==='staff' && r.status==='active') hierarchyCounts.staff += n;
      if (r.status==='invited') hierarchyCounts.invited += n;
    }
  } catch (error) {
    dbReady = false;
    console.error('[admin:team] hierarchy tables unavailable; apply organization migration', error);
  }
  let assignmentUsers: { id: string; display_name: string | null; email: string }[] = [];
  let assignmentDepartments: { id: string; name: string }[] = [];
  let assignmentTeams: { id: string; department_id: string; name: string }[] = [];
  let assignmentReady = false;
  try {
    const [u, d, t] = await Promise.all([
      db.query(`SELECT id, display_name, email FROM users WHERE status='active' ORDER BY COALESCE(display_name,email), email LIMIT 500`),
      db.query(`SELECT id, name FROM admin_departments WHERE COALESCE(to_jsonb(admin_departments)->>'status','active')='active' ORDER BY name`),
      db.query(`SELECT id, department_id, name FROM admin_teams ORDER BY name`),
    ]);
    assignmentUsers = u.rows;
    assignmentDepartments = d.rows;
    assignmentTeams = t.rows;
    assignmentReady = true;
  } catch (error) {
    console.error('[admin:team] assignment options unavailable', error);
  }

  const metrics = [
    ['Sub-admins', hierarchyCounts.subAdmins], ['Team leaders', hierarchyCounts.leaders],
    ['Staff', hierarchyCounts.staff], ['Pending invitations', hierarchyCounts.invited],
  ];
  return <main style={{minHeight:'100vh',background:'#f5f6fb',color:'#182033',fontFamily:'Arial,Helvetica,sans-serif',padding:'clamp(16px,3vw,36px)'}}>
    <div style={{maxWidth:1360,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:18}}>
        <Link href="/admin" style={{textDecoration:'none',color:'#30247e',fontWeight:850,fontSize:18}}>DigiNanba · ADMIN</Link>
        <span style={{fontSize:12,color:'#6e778d'}}>Signed in as {session.user.name ?? session.user.email ?? 'Administrator'}</span>
      </header>
      <nav aria-label="Admin navigation" style={{display:'flex',gap:8,overflowX:'auto',padding:'5px 1px 17px',scrollbarGutter:'stable'}}>
        {[
          ['/admin/business','Business analytics'],['/admin','Overview'],['/admin/catalog','Products'],['/admin/users','Users'],['/admin/orders','Orders & Finance'],['/admin/factory','AI Product Factory'],['/admin/markets','Global Markets'],['/admin/analytics','Analytics'],['/admin/activity','Audit & Activity'],['/admin/team','Team & hierarchy']
        ].map(([href,label])=><Link key={href} href={href} aria-current={href==='/admin/team'?'page':undefined} style={{flex:'0 0 auto',whiteSpace:'nowrap',textDecoration:'none',borderRadius:999,padding:'10px 13px',fontSize:12,fontWeight:750,background:href==='/admin/team'?'#5143d8':'#fff',color:href==='/admin/team'?'#fff':'#586176',border:'1px solid #e5e7f0'}}>{label}</Link>)}
      </nav>
      <section style={{background:'linear-gradient(120deg,#173b2d,#176b45)',color:'#fff',borderRadius:22,padding:'clamp(22px,3vw,34px)',margin:'12px 0 22px'}}>
        <div style={{fontSize:11,letterSpacing:1.5,fontWeight:850,color:'#bcebd0'}}>ORGANIZATION & STAFF</div>
        <h1 style={{fontSize:'clamp(27px,3.5vw,38px)',letterSpacing:-1,margin:'10px 0'}}>Team & hierarchy</h1>
        <p style={{maxWidth:850,lineHeight:1.7,color:'#e0f6e8',margin:0}}>One reporting structure across DigiNanba: Chief Admin → Department Sub-Admins → Team Leaders → Staff. Departments remain separated so access can be restricted by responsibility.</p>
      </section>
      {!dbReady && <section style={{background:'#fff6df',border:'1px solid #f0dba2',borderRadius:14,padding:16,marginBottom:18,color:'#765517',fontSize:13,lineHeight:1.6}}>The hierarchy screen is deployed, but its database tables are not available yet. Run the organization hierarchy migration linked below in Neon, then refresh this page.</section>}
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:22}}>
        {metrics.map(([label,value])=><article key={label} style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:16,padding:18}}><div style={{fontSize:12,color:'#778095',fontWeight:750}}>{label}</div><div style={{fontSize:30,fontWeight:850,marginTop:8}}>{dbReady?Number(value).toLocaleString('en-IN'):'—'}</div></article>)}
      </section>
      <section style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,padding:20,marginBottom:22}}>
        <h2 style={{margin:'0 0 16px',fontSize:20}}>Reporting levels</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
          {levels.map((level,i)=><article key={level.n} style={{border:'1px solid #e7e9f1',borderRadius:14,padding:16,background:i===0?'#f0edff':'#fff'}}>
            <div style={{fontSize:11,fontWeight:850,color:'#6c5af2',letterSpacing:1}}>LEVEL {level.n}</div><h3 style={{fontSize:16,margin:'10px 0 7px'}}>{level.title}</h3><p style={{fontSize:12,color:'#6f788d',lineHeight:1.65,margin:0}}>{level.desc}</p>
          </article>)}
        </div>
      </section>
      <section style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,padding:20,marginBottom:22}}>
        <h2 style={{margin:'0 0 7px',fontSize:20}}>Assign real users to roles</h2>
        <p style={{fontSize:13,color:'#778095',lineHeight:1.6,margin:'0 0 16px'}}>Choose an existing active account and assign it to a department. Team leaders and staff must also be assigned to a team. Only Super Admin accounts can submit assignments.</p>
        {new URLSearchParams().get('assigned') === '1' && <p role="status" style={{color:'#087f65',fontSize:13,fontWeight:750}}>Membership assigned successfully.</p>}
        {!assignmentReady ? <p style={{fontSize:13,color:'#a15d0b'}}>Assignment options could not be loaded. Check the database schema and refresh.</p> :
        assignmentUsers.length === 0 ? <p style={{fontSize:13,color:'#a15d0b'}}>No active user accounts are available to assign. Create or activate real user accounts first.</p> :
        <form action={assignTeamMembership} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,alignItems:'end'}}>
          <label style={{fontSize:12,fontWeight:750,color:'#596276'}}>Active user
            <select name="userId" required defaultValue="" style={{display:'block',width:'100%',marginTop:7,padding:11,border:'1px solid #dfe3ed',borderRadius:9,background:'#fff',color:'#182033'}}>
              <option value="" disabled>Select a user</option>{assignmentUsers.map(u=><option key={u.id} value={u.id}>{u.display_name ? u.display_name + ' — ' : ''}{u.email}</option>)}
            </select>
          </label>
          <label style={{fontSize:12,fontWeight:750,color:'#596276'}}>Department
            <select name="departmentId" required defaultValue="" style={{display:'block',width:'100%',marginTop:7,padding:11,border:'1px solid #dfe3ed',borderRadius:9,background:'#fff',color:'#182033'}}>
              <option value="" disabled>Select a department</option>{assignmentDepartments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label style={{fontSize:12,fontWeight:750,color:'#596276'}}>Role
            <select name="roleCode" required defaultValue="staff" style={{display:'block',width:'100%',marginTop:7,padding:11,border:'1px solid #dfe3ed',borderRadius:9,background:'#fff',color:'#182033'}}>
              <option value="sub_admin">Department Sub-Admin</option><option value="team_leader">Team Leader</option><option value="staff">Staff</option>
            </select>
          </label>
          <label style={{fontSize:12,fontWeight:750,color:'#596276'}}>Team (required for leader/staff)
            <select name="teamId" defaultValue="" style={{display:'block',width:'100%',marginTop:7,padding:11,border:'1px solid #dfe3ed',borderRadius:9,background:'#fff',color:'#182033'}}>
              <option value="">No team / department sub-admin</option>{assignmentTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label style={{fontSize:12,fontWeight:750,color:'#596276'}}>Job title (optional)
            <input name="jobTitle" maxLength={100} placeholder="e.g. Customer Care Lead" style={{display:'block',width:'100%',marginTop:7,padding:11,border:'1px solid #dfe3ed',borderRadius:9,background:'#fff',color:'#182033'}} />
          </label>
          <button type="submit" style={{border:0,borderRadius:10,padding:'12px 16px',minHeight:42,background:'#176b45',color:'#fff',fontWeight:800,cursor:'pointer'}}>Assign membership</button>
        </form>}
        <p style={{fontSize:11,color:'#778095',lineHeight:1.6,margin:'13px 0 0'}}>This assigns an organizational membership only. It does not automatically grant application-wide permissions or create login accounts; those controls must be implemented separately.</p>
      </section>
      <section>
        <div style={{marginBottom:14}}><h2 style={{fontSize:21,margin:'0 0 6px'}}>Departments & team structure</h2><p style={{fontSize:13,color:'#778095',margin:0}}>Eight functional departments with seeded operating teams. Team leaders and staff are counted after real user accounts are assigned.</p></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>
          {departments.map((dept)=>{const found=deptRows.find(d=>d.code===dept.code);return <article key={dept.code} style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:16,padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><h3 style={{fontSize:16,margin:0}}>{dept.name}</h3><span style={{fontSize:10,fontWeight:800,color:found?.status==='active'?'#087f65':'#8991a3',background:found?.status==='active'?'#e6f7f0':'#f0f2f6',borderRadius:999,padding:'5px 8px'}}>{found?.status ?? (dbReady?'Not seeded':'Pending setup')}</span></div>
            <p style={{fontSize:12,color:'#778095',lineHeight:1.6,minHeight:38}}>{dept.desc}</p>
            <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:12,color:'#596276'}}><span><b>{found?.teams ?? 0}</b> teams</span><span><b>{found?.leaders ?? 0}</b> leaders</span><span><b>{found?.members ?? 0}</b> active members</span></div>{found?.team_names && <p style={{fontSize:11,color:'#687187',lineHeight:1.6,margin:'12px 0 0',paddingTop:10,borderTop:'1px solid #edf0f5'}}><b>Teams:</b> {found.team_names}</p>}
          </article>})}
        </div>
      </section>
      <section style={{marginTop:22,background:'#fff',border:'1px solid #e7e9f1',borderRadius:16,padding:18}}>
        <h2 style={{fontSize:17,margin:'0 0 8px'}}>Role boundaries</h2>
        <ul style={{fontSize:13,color:'#687187',lineHeight:1.8,margin:0,paddingLeft:20}}>
          <li><b>Chief / Super Admin:</b> organization-wide oversight and role governance.</li>
          <li><b>Department Sub-Admin:</b> only their assigned department, its teams, and reporting.</li>
          <li><b>Team Leader:</b> assigned team members, task allocation and escalation.</li>
          <li><b>Staff:</b> assigned tasks and minimum required permissions.</li>
        </ul>
        <p style={{fontSize:12,color:'#778095',lineHeight:1.6,marginBottom:0}}>Default operating teams are seeded by the follow-up migration. Team-leader and staff counts remain zero until real user accounts are assigned; this avoids creating fictitious employees. Staff invitations, membership assignment and fine-grained API permission enforcement still need to be connected before granting operational access.</p>
        <p style={{fontSize:12,marginBottom:0,marginTop:12}}><Link href="https://github.com/agnengineeringselectricals-crypto/diginanba/blob/main/db/migrations/20261014_seed_default_admin_teams.sql" style={{color:'#5143d8',fontWeight:800}}>Open default teams migration for Neon →</Link></p>
      </section>
      <footer style={{marginTop:18,color:'#8991a3',fontSize:11}}>DigiNanba private administration · Organization structure</footer>
    </div>
  </main>;
}
