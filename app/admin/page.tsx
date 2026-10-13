import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

const departments = [
  { code: 'accounts-security', name: 'Accounts & Security', icon: '🛡️', summary: 'Administrator accounts, role assignments and security reviews.', roles: ['Super Admin', 'Operations Admin', 'Admin Accounts & Security'] },
  { code: 'customer-care', name: 'Customer Care', icon: '🎧', summary: 'Support tickets, complaints, refunds requests and escalations.', roles: ['Super Admin', 'Support Agent', 'Admin Customer Care', 'Customer Care Team Leader', 'Customer Care Staff'] },
  { code: 'products-catalog', name: 'Products & Catalog', icon: '📦', summary: 'Product quality, catalog updates, pricing and publishing review.', roles: ['Super Admin', 'Catalog Manager', 'Admin Products & Catalog', 'Products Team Leader', 'Products Staff'] },
  { code: 'users-creators', name: 'Users & Creators', icon: '👥', summary: 'Creator onboarding, account reviews and marketplace trust.', roles: ['Super Admin', 'Operations Admin', 'Admin Users & Creators', 'Users & Creators Team Leader', 'Users & Creators Staff'] },
  { code: 'ai-factory', name: 'AI Product Factory', icon: '🤖', summary: 'Market research, product jobs, localization and draft review.', roles: ['Super Admin', 'AI Factory Manager', 'Admin AI Factory', 'AI Factory Team Leader', 'AI Factory Staff'] },
  { code: 'finance-payments', name: 'Finance & Payments', icon: '💳', summary: 'Orders, refunds, creator commissions and settlement controls.', roles: ['Super Admin', 'Finance Manager', 'Admin Finance & Payments', 'Finance Team Leader', 'Finance Staff'] },
  { code: 'marketing-growth', name: 'Marketing & Growth', icon: '📈', summary: 'SEO, campaigns, promotions and performance reports.', roles: ['Super Admin', 'Admin Marketing & Growth', 'Marketing Team Leader', 'Marketing Staff'] },
  { code: 'localization-markets', name: 'Localization & Markets', icon: '🌍', summary: 'Regional catalogs, languages, currencies and market settings.', roles: ['Super Admin', 'Admin Localization & Markets', 'Localization Team Leader', 'Localization Staff'] },
];

const accessRoles = [
  'Super Admin', 'Operations Admin', 'Catalog Manager', 'Finance Manager',
  'Support Agent', 'AI Factory Manager', 'Read-Only Analyst',
  ...departments.flatMap((department) => department.roles),
];

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/admin/login');

  const result = await db.query(
    `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.name`,
    [session.user.id],
  );
  const assignedRoles = (result.rows as { name: string }[]).map((row) => row.name);
  const isChiefAdmin = assignedRoles.includes('Super Admin');
  const isAdmin = assignedRoles.some((role) => accessRoles.includes(role));
  if (!isAdmin) redirect('/account');

  const visibleDepartments = departments.filter((department) =>
    isChiefAdmin || assignedRoles.some((role) => department.roles.includes(role)),
  );

  return (
    <main className="page" style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px 64px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <span className="eyebrow">PRIVATE ADMINISTRATION PORTAL</span>
          <h1 style={{ margin: '8px 0', fontSize: 36 }}>DigiNanba Control Centre</h1>
          <p className="muted" style={{ margin: 0 }}>Signed in as {session.user.email ?? session.user.name ?? 'administrator'}</p>
        </div>
        <div style={{ background: '#ecfdf3', color: '#047857', borderRadius: 999, padding: '9px 13px', fontSize: 13, fontWeight: 700 }}>
          {isChiefAdmin ? 'Chief Admin · Super Admin' : 'Role-scoped access'}
        </div>
      </div>

      {isChiefAdmin && (
        <section className="panel" style={{ marginBottom: 22 }}>
          <h2 style={{ marginBottom: 8 }}>Chief Admin</h2>
          <p className="muted">Platform-wide oversight, department governance, security policy and emergency controls. High-risk role changes and financial actions should use approval and audit workflows.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="pill">All departments</span><span className="pill">Role governance</span><span className="pill">Security & audit</span>
          </div>
        </section>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, margin: '30px 0 16px', flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: '0 0 5px' }}>Departments</h2><p className="muted" style={{ margin: 0 }}>Each department can have an administrator, team leaders and staff with scoped permissions.</p></div>
        <span className="eyebrow">{visibleDepartments.length} departments available to your role</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {visibleDepartments.map((department) => (
          <section key={department.code} className="card" style={{ minHeight: 205 }}>
            <div style={{ fontSize: 28 }} aria-hidden="true">{department.icon}</div>
            <h3>{department.name}</h3>
            <p className="muted">{department.summary}</p>
            <div style={{ borderTop: '1px solid #e7e8ee', paddingTop: 12, marginTop: 14, fontSize: 12, color: '#6b7280' }}>
              Structure: Department Admin → Team Leader → Staff
            </div>
          </section>
        ))}
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Security rules</h2>
        <ul style={{ color: '#596273', lineHeight: 1.9, paddingLeft: 20 }}>
          <li>Public customer and creator accounts do not receive administrator access by default.</li>
          <li>Department visibility is filtered by assigned roles; APIs must enforce permissions independently.</li>
          <li>Only the Chief Admin or an explicitly delegated role should manage administrator assignments.</li>
          <li>AI-generated products remain drafts until an authorized reviewer approves them.</li>
        </ul>
        <p className="muted" style={{ marginBottom: 0 }}>This dashboard is the hierarchy foundation. Staff invitation, team assignment and permission-management actions will be enabled only after their server-side endpoints and database migration are deployed and verified.</p>
      </section>
    </main>
  );
}
