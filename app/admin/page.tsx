import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

async function countRows(metric: 'users' | 'products' | 'orders' | 'categories' | 'pendingOrders' | 'draftProducts' | 'failedFactoryJobs') {
  const queries = {
    users: 'SELECT COUNT(*)::int AS count FROM users',
    products: 'SELECT COUNT(*)::int AS count FROM products',
    orders: 'SELECT COUNT(*)::int AS count FROM orders',
    categories: 'SELECT COUNT(*)::int AS count FROM categories',
    pendingOrders: "SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending'",
    draftProducts: "SELECT COUNT(*)::int AS count FROM products WHERE status = 'draft'",
    failedFactoryJobs: "SELECT COUNT(*)::int AS count FROM product_factory_jobs WHERE status = 'failed'",
  } as const;
  try {
    const result = await db.query(queries[metric]);
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

const adminAreas = [
  { href: '/admin/business', icon: '↗', number: '01', title: 'Business analytics', description: 'Review business performance with daily, weekly, monthly, yearly and custom-range graphs for products, users, orders and paid order value.', detail: 'PERFORMANCE & TRENDS', color: '#087f8c', tint: '#e6f7f7' },
  { href: '/admin/energy-intelligence', icon: 'ϟ', number: '09', title: 'Energy Intelligence', description: 'Monitor industrial substations, energy meters, gateway health, power quality, consumption trends and operational alerts.', detail: 'INDUSTRIAL IOT & ENERGY', color: '#087f8c', tint: '#e6f7f7' },
  { href: '/admin/catalog', icon: '▦', number: '02', title: 'Catalog management', description: 'Review product records, editions, pricing and publishing status.', detail: 'PRODUCTS & CATEGORIES', color: '#6757f5', tint: '#f0edff' },
  { href: '/admin/creator-review', icon: '✎', number: '08', title: 'Creator & custom requests', description: 'Review creator publication submissions and manage customer customization requests.', detail: 'CREATOR PUBLISHING', color: '#176b45', tint: '#e8f7ee' },
  { href: '/admin/users', icon: '♙', number: '03', title: 'Users & access', description: 'Manage administrator access and review role assignments.', detail: 'ACCOUNTS & PERMISSIONS', color: '#087f8c', tint: '#e6f7f7' },
  { href: '/admin/orders', icon: '↗', number: '04', title: 'Orders & finance', description: 'Monitor order activity and prepare for payment operations.', detail: 'ORDERS & SETTLEMENTS', color: '#b76b12', tint: '#fff4e4' },
  { href: '/admin/factory', icon: '✦', number: '05', title: 'AI Product Factory', description: 'Review private product-generation operations and factory readiness.', detail: 'AUTOMATION & AI', color: '#a044b5', tint: '#faedff' },
  { href: '/admin/ai-workforce', icon: '✓', number: '07', title: 'AI Workforce Review', description: 'Review AI reports, record approval decisions and track scheduled task execution.', detail: 'AI TASKS & APPROVALS', color: '#176b45', tint: '#e8f7ee' },
  { href: '/admin/team', icon: '♧', number: '06', title: 'Team & hierarchy', description: 'Organize the Chief Admin, department sub-admins, team leaders and staff across marketplace operations.', detail: 'ORGANIZATION & STAFF', color: '#176b45', tint: '#e8f7ee' },
];

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/admin/login');

  const roleResult = await db.query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND r.name IN ('Super Admin', 'Operations Admin', 'Catalog Manager', 'Finance Manager', 'Support Agent', 'AI Factory Manager', 'Read-Only Analyst')
     ORDER BY CASE WHEN r.name = 'Super Admin' THEN 0 ELSE 1 END, r.name`,
    [session.user.id],
  );
  if (!roleResult.rowCount) redirect('/account');
  const roleNames = new Set<string>(roleResult.rows.map((row: { name: string }) => String(row.name)));
  const areaRoles: Record<string, string[]> = {
    '/admin/business': ['Super Admin', 'Operations Admin', 'Finance Manager', 'Read-Only Analyst'],
    '/admin/energy-intelligence': ['Super Admin', 'Operations Admin', 'Read-Only Analyst'],
    '/admin/catalog': ['Super Admin', 'Operations Admin', 'Catalog Manager'],
    '/admin/creator-review': ['Super Admin', 'Operations Admin', 'Catalog Manager'],
    '/admin/users': ['Super Admin', 'Operations Admin', 'Support Agent'],
    '/admin/orders': ['Super Admin', 'Operations Admin', 'Finance Manager'],
    '/admin/factory': ['Super Admin', 'AI Factory Manager'],
    '/admin/ai-workforce': ['Super Admin', 'Operations Admin'],
    '/admin/team': ['Super Admin', 'Operations Admin'],
  };

  const [users, products, orders, categories, pendingOrders, draftProducts, failedFactoryJobs] = await Promise.all([
    countRows('users'), countRows('products'), countRows('orders'), countRows('categories'),
    countRows('pendingOrders'), countRows('draftProducts'), countRows('failedFactoryJobs'),
  ]);
  const roleName = roleResult.rows.map((row: { name: string }) => String(row.name)).join(', ');
  const metric = (value: number | null) => value === null ? '—' : value.toLocaleString('en-US');
  const stats = [
    { label: 'Registered users', value: metric(users), icon: '♙', note: 'Marketplace accounts', color: '#6554ed', tint: '#f0edff' },
    { label: 'Published products', value: metric(products), icon: '▣', note: 'Digital products', color: '#087f8c', tint: '#e6f7f7' },
    { label: 'Orders placed', value: metric(orders), icon: '↗', note: 'All recorded orders', color: '#b76b12', tint: '#fff4e4' },
    { label: 'Categories', value: metric(categories), icon: '▦', note: 'Product categories', color: '#a044b5', tint: '#faedff' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f5f6fb', color: '#182033', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <style>{`

        .dn-admin-shell{max-width:1440px;margin:0 auto;padding:32px 42px 48px}
        .dn-admin-top{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:30px}
        .dn-admin-brand{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:850;letter-spacing:-.5px}
        .dn-admin-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#6b5af7,#4534c9);display:grid;place-items:center;color:#fff;font-size:20px;box-shadow:0 8px 18px #6554ed35}
        .dn-admin-user{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e7e9f1;border-radius:15px;padding:9px 14px;max-width:100%}
        .dn-admin-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#eeeaff;color:#5848d8;font-weight:800;flex-shrink:0}
        .dn-admin-statgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:24px 0 36px}
        .dn-admin-stat{background:#fff;border:1px solid #e8eaf2;border-radius:18px;padding:21px;box-shadow:0 4px 18px #1b24400a;min-width:0;transition:transform .18s,box-shadow .18s}
        .dn-admin-areas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
        .dn-admin-area{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e8eaf2;border-radius:20px;padding:23px;min-width:0;position:relative;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .dn-admin-card-hit{position:absolute;inset:0;z-index:1;border-radius:20px;display:block;outline-offset:4px}
        .dn-admin-card-hit:focus-visible{outline:3px solid #6757f5}
        .dn-admin-open{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin-top:14px;padding:12px 15px;min-height:44px;max-width:100%;border-radius:10px;background:#f0edff;color:#5141d8;font-size:12px;font-weight:800;text-decoration:none;position:relative;z-index:2}
        .dn-admin-open:focus-visible{outline:3px solid #6757f5;outline-offset:3px}
        .dn-admin-area:hover{box-shadow:0 14px 32px #1b244012;border-color:#c9c3ff;transform:translateY(-2px)}
        .dn-admin-open:hover{background:#e3ddff}
        .dn-admin-sectionhead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:17px}
        .dn-admin-stat:focus-within{outline:2px solid #c9c3ff}
        @media(max-width:1000px){.dn-admin-shell{padding:26px 22px}.dn-admin-statgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:620px){.dn-admin-shell{padding:18px 14px 32px}.dn-admin-top{align-items:flex-start;flex-direction:column;margin-bottom:24px}.dn-admin-statgrid{gap:10px;margin:18px 0 28px}.dn-admin-stat{padding:15px;border-radius:16px}.dn-admin-areas{grid-template-columns:1fr}.dn-admin-area{padding:19px}.dn-admin-sectionhead{align-items:flex-start;flex-direction:column}.dn-admin-user{width:100%}}
        @media(prefers-reduced-motion:reduce){.dn-admin-area,.dn-admin-stat{transition:none}}
      `}</style>
      <div className="dn-admin-shell">
        <header className="dn-admin-top">
          <div className="dn-admin-brand"><div className="dn-admin-mark">D</div><div>DigiNanba <span style={{ display: 'block', fontSize: 11, letterSpacing: '1.8px', color: '#7a8295', marginTop: 3 }}>ADMIN CONSOLE</span></div></div>
          <div className="dn-admin-user"><div className="dn-admin-avatar">{(session.user.name ?? session.user.email ?? 'A').slice(0, 1).toUpperCase()}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 750, overflowWrap: 'anywhere' }}>{session.user.name ?? session.user.email ?? 'Administrator'}</div><div style={{ fontSize: 11, color: '#778095', marginTop: 3 }}>Access role: <span style={{ color: '#087f65', fontWeight: 750 }}>{roleName}</span></div></div><span aria-hidden="true" style={{ color: '#7c8497', paddingLeft: 4 }}>●</span></div>
        </header>

        <nav aria-label="Admin navigation" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, overflowX: 'visible', padding: '3px 1px 18px', marginBottom: 5, maxWidth: '100%' }}>
          {[
            { href: '/admin/business', label: 'Business analytics', roles: ['Super Admin', 'Operations Admin', 'Finance Manager', 'Read-Only Analyst'] },
            { href: '/admin', label: 'Overview', roles: ['Super Admin', 'Operations Admin', 'Catalog Manager', 'Finance Manager', 'Support Agent', 'AI Factory Manager', 'Read-Only Analyst'] },
            { href: '/admin/catalog', label: 'Products', roles: ['Super Admin', 'Operations Admin', 'Catalog Manager'] },
            { href: '/admin/creator-review', label: 'Creator review', roles: ['Super Admin', 'Operations Admin', 'Catalog Manager'] },
            { href: '/admin/users', label: 'Users', roles: ['Super Admin', 'Operations Admin', 'Support Agent'] },
            { href: '/admin/orders', label: 'Orders & Finance', roles: ['Super Admin', 'Operations Admin', 'Finance Manager'] },
            { href: '/admin/factory', label: 'AI Product Factory', roles: ['Super Admin', 'AI Factory Manager'] },
            { href: '/admin/ai-workforce', label: 'AI Workforce Review', roles: ['Super Admin', 'Operations Admin'] },
            { href: '/admin/team', label: 'Team & hierarchy', roles: ['Super Admin', 'Operations Admin'] },
            { href: '/admin/markets', label: 'Global Markets', roles: ['Super Admin', 'Operations Admin'] },
            { href: '/admin/analytics', label: 'Analytics', roles: ['Super Admin', 'Operations Admin', 'Finance Manager', 'Read-Only Analyst'] },
            { href: '/admin/energy-intelligence', label: 'Energy Intelligence', roles: ['Super Admin', 'Operations Admin', 'Read-Only Analyst'] },
            { href: '/admin/activity', label: 'Audit & Activity', roles: ['Super Admin', 'Operations Admin'] },
          ].filter((item) => item.roles.some((role) => roleNames.has(role))).map((item) => <Link key={item.href} href={item.href} aria-current={item.href === '/admin' ? 'page' : undefined} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', textDecoration: 'none', borderRadius: 999, padding: '10px 13px', fontSize: 12, lineHeight: 1.3, fontWeight: 750, background: item.href === '/admin' ? '#5143d8' : '#fff', color: item.href === '/admin' ? '#fff' : '#586176', border: '1px solid #e5e7f0', maxWidth: '100%' }}>{item.label}</Link>)}
        </nav>

        <section style={{ borderRadius: 26, padding: 'clamp(18px,2.5vw,28px)', color: '#fff', background: 'radial-gradient(circle at 85% 15%, #7669ff 0, transparent 34%), linear-gradient(120deg,#211b58 0%,#4033a7 58%,#5b4df6 100%)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 740 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #ffffff35', background: '#ffffff12', padding: '7px 11px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 1.3 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6ee7b7' }} /> PRIVATE ADMINISTRATION</div>
            <h1 style={{ fontSize: 'clamp(25px,3vw,34px)', letterSpacing: '-1.5px', lineHeight: 1.08, margin: '12px 0 8px' }}>Your marketplace,<br />at a glance.</h1>
            <p style={{ color: '#e0ddff', fontSize: 15, lineHeight: 1.7, maxWidth: 560, margin: 0 }}>Your control center for products, users, orders and AI-powered marketplace operations.</p>
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', right: '-32px', bottom: '-95px', width: 280, height: 280, border: '1px solid #ffffff26', borderRadius: '50%' }}><div style={{ position: 'absolute', inset: 28, border: '1px solid #ffffff26', borderRadius: '50%' }}><div style={{ position: 'absolute', inset: 28, border: '1px solid #ffffff26', borderRadius: '50%' }} /></div></div>
        </section>

        <section aria-label="Marketplace overview">
          <div className="dn-admin-sectionhead" style={{ marginTop: 34 }}>
            <div><div style={{ color: '#6c5af2', fontSize: 11, fontWeight: 850, letterSpacing: 1.5 }}>LIVE OVERVIEW</div><h2 style={{ margin: '7px 0 0', fontSize: 23, letterSpacing: '-.5px' }}>Marketplace snapshot</h2></div>
            <div style={{ color: '#778095', fontSize: 12 }}>Production database summary</div>
          </div>
          <div className="dn-admin-statgrid">
            {stats.map((item) => <article key={item.label} className="dn-admin-stat">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span style={{ color: '#626c82', fontSize: 13, fontWeight: 650 }}>{item.label}</span><span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: item.tint, color: item.color, fontSize: 21 }}>{item.icon}</span></div>
              <div style={{ fontSize: 34, fontWeight: 850, letterSpacing: '-1px', marginTop: 17, color: '#192137' }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#8991a3', marginTop: 5 }}>{item.note}</div>
            </article>)}
          </div>
        </section>

        <section aria-label="Items needing attention" style={{ marginBottom: 34 }}>
          <div className="dn-admin-sectionhead"><div><div style={{ color: '#6c5af2', fontSize: 11, fontWeight: 850, letterSpacing: 1.5 }}>OPERATIONS</div><h2 style={{ margin: '7px 0 0', fontSize: 21, letterSpacing: '-.4px' }}>Items needing attention</h2></div><div style={{ color: '#778095', fontSize: 12 }}>Live counts from the database</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
            {[
              { label: 'Pending orders', value: pendingOrders, href: '/admin/orders', note: 'Require payment/status review', color: '#a15d0b' },
              { label: 'Draft products', value: draftProducts, href: '/admin/catalog', note: 'Not yet published', color: '#5141d8' },
              { label: 'Failed factory jobs', value: failedFactoryJobs, href: '/admin/factory', note: 'Retry only after checking errors', color: '#a23a3a' },
            ].filter(item => item.href !== '/admin/factory' || roleNames.has('Super Admin') || roleNames.has('AI Factory Manager')).filter(item => item.href !== '/admin/orders' || ['Super Admin','Operations Admin','Finance Manager'].some(role => roleNames.has(role))).filter(item => item.href !== '/admin/catalog' || ['Super Admin','Operations Admin','Catalog Manager'].some(role => roleNames.has(role))).map(item => <Link key={item.label} href={item.href} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid #e8eaf2', borderRadius: 16, padding: 17 }}>
              <div style={{ color: item.color, fontSize: 12, fontWeight: 800 }}>{item.label}</div>
              <div style={{ fontSize: 30, fontWeight: 850, letterSpacing: '-.8px', marginTop: 9 }}>{item.value === null ? '—' : item.value.toLocaleString('en-US')}</div>
              <div style={{ fontSize: 11, color: '#8991a3', marginTop: 5 }}>{item.note}</div>
            </Link>)}
          </div>
        </section>

        <section>
          <div className="dn-admin-sectionhead"><div><div style={{ color: '#6c5af2', fontSize: 11, fontWeight: 850, letterSpacing: 1.5 }}>WORKSPACE</div><h2 style={{ margin: '7px 0 0', fontSize: 23, letterSpacing: '-.5px' }}>Administration areas</h2><p style={{ color: '#788196', margin: '7px 0 0', fontSize: 14 }}>Choose an area to review its current capabilities.</p></div></div>
          <div className="dn-admin-areas">
            {adminAreas.filter((area) => (areaRoles[area.href] ?? []).some((role) => roleNames.has(role))).map((area) => <article key={area.number} className="dn-admin-area">
              <Link href={area.href} className="dn-admin-card-hit" aria-label={`Open ${area.title}`} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 15, background: area.tint, color: area.color, fontSize: 25, fontWeight: 750 }}>{area.icon}</div>
                <span style={{ fontSize: 12, color: '#a0a6b5', fontWeight: 800, letterSpacing: 1 }}>{area.number}</span>
              </div>
              <h3 style={{ fontSize: 19, letterSpacing: '-.3px', margin: '20px 0 8px' }}>{area.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: '#70798e', margin: '0 0 20px', minHeight: 43 }}>{area.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #eef0f5', paddingTop: 15 }}><span style={{ color: area.color, fontSize: 10, fontWeight: 850, letterSpacing: 1 }}>{area.detail}</span><span aria-hidden="true" style={{ color: area.color, fontSize: 20 }}>↗</span></div><Link href={area.href} className="dn-admin-open" aria-label={`Open ${area.title}`}>Open {area.title} <span aria-hidden="true">→</span></Link>
            </article>)}
          </div>
        </section>
        <footer style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderTop: '1px solid #e5e8f0', marginTop: 30, paddingTop: 18, color: '#8a92a4', fontSize: 11, lineHeight: 1.6 }}><span>© DigiNanba · Private administration</span><span>Summary counts come from the production database. A dash means a table could not be queried.</span></footer>
      </div>
    </main>
  );
}
