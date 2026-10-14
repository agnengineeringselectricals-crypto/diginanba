import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

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
  let deptRows: { code: string; name: string; status: string; teams: number; members: number; leaders: number }[] = [];
  let hierarchyCounts = { chief: 0, subAdmins: 0, leaders: 0, staff: 0, invited: 0 };
  try {
    const [deptResult, memberResult] = await Promise.all([
      db.query(`SELECT d.code,d.name,COALESCE(to_jsonb(d)->>'status','active') AS status,COUNT(DISTINCT t.id)::int AS teams,
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
      <section>
        <div style={{marginBottom:14}}><h2 style={{fontSize:21,margin:'0 0 6px'}}>Departments & team structure</h2><p style={{fontSize:13,color:'#778095',margin:0}}>Eight functional departments, each able to contain multiple teams, leaders and staff.</p></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>
          {departments.map((dept)=>{const found=deptRows.find(d=>d.code===dept.code);return <article key={dept.code} style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:16,padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><h3 style={{fontSize:16,margin:0}}>{dept.name}</h3><span style={{fontSize:10,fontWeight:800,color:found?.status==='active'?'#087f65':'#8991a3',background:found?.status==='active'?'#e6f7f0':'#f0f2f6',borderRadius:999,padding:'5px 8px'}}>{found?.status ?? (dbReady?'Not seeded':'Pending setup')}</span></div>
            <p style={{fontSize:12,color:'#778095',lineHeight:1.6,minHeight:38}}>{dept.desc}</p>
            <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:12,color:'#596276'}}><span><b>{found?.teams ?? 0}</b> teams</span><span><b>{found?.leaders ?? 0}</b> leaders</span><span><b>{found?.members ?? 0}</b> active members</span></div>
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
        <p style={{fontSize:12,color:'#778095',lineHeight:1.6,marginBottom:0}}>This first dashboard stage establishes the hierarchy and database structure. Staff invitation, assigning team leaders, and fine-grained API permission enforcement must be connected before granting real operational access.</p>
        <p style={{fontSize:12,marginBottom:0,marginTop:12}}><Link href="https://github.com/agnengineeringselectricals-crypto/diginanba/blob/main/db/migrations/20261014_admin_organization_hierarchy.sql" style={{color:'#5143d8',fontWeight:800}}>Open organization hierarchy migration for Neon →</Link></p>
      </section>
      <footer style={{marginTop:18,color:'#8991a3',fontSize:11}}>DigiNanba private administration · Organization structure</footer>
    </div>
  </main>;
}
