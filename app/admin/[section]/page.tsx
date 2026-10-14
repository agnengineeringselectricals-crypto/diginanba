import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import FactoryControls from '../FactoryControls';

type SectionKey = 'catalog' | 'users' | 'orders' | 'factory' | 'markets' | 'analytics' | 'activity';
type Column = { key: string; label: string };
const sections: Record<SectionKey, { title: string; eyebrow: string; description: string; columns: Column[]; query: string }> = {
  catalog: {
    title: 'Catalog management', eyebrow: 'PRODUCTS & CATEGORIES',
    description: 'Review digital product listings, publishing status and product types. Editing and publishing controls will be enabled after validation rules are connected.',
    columns: [{key:'title',label:'Product'}, {key:'product_type',label:'Type'}, {key:'status',label:'Status'}, {key:'created_at',label:'Created'}],
    query: 'SELECT title, product_type, status, created_at FROM products ORDER BY created_at DESC LIMIT 50',
  },
  users: {
    title: 'Users & access', eyebrow: 'ACCOUNTS & PERMISSIONS',
    description: 'Review marketplace accounts and account status. Passwords and authentication secrets are never displayed here.',
    columns: [{key:'display_name',label:'Name'}, {key:'email',label:'Email'}, {key:'status',label:'Status'}, {key:'created_at',label:'Registered'}],
    query: 'SELECT display_name, email, status, created_at FROM users ORDER BY created_at DESC LIMIT 50',
  },
  orders: {
    title: 'Orders & finance', eyebrow: 'ORDERS & SETTLEMENTS',
    description: 'Review recent orders and recorded payment statuses. Totals are stored in minor currency units; no live payment or refund action is exposed until provider reconciliation is implemented.',
    columns: [{key:'id',label:'Order ID'}, {key:'status',label:'Order status'}, {key:'payment_status',label:'Payment status'}, {key:'provider',label:'Provider'}, {key:'currency_code',label:'Currency'}, {key:'total_minor',label:'Total (minor units)'}, {key:'created_at',label:'Created'}],
    query: `SELECT o.id, o.status, COALESCE(p.status, 'no payment record') AS payment_status, p.provider, o.currency_code, o.total_minor, o.created_at FROM orders o LEFT JOIN LATERAL (SELECT status, provider FROM payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) p ON true ORDER BY o.created_at DESC LIMIT 50`,
  },
  factory: {
    title: 'AI Product Factory', eyebrow: 'AUTOMATION & AI',
    description: 'Inspect the persistent product-factory queue, job outcomes, markets and errors. This screen is read-only while the worker execution and safe retry controls are being verified.',
    columns: [{key:'job_type',label:'Job type'}, {key:'status',label:'Status'}, {key:'market_code',label:'Market'}, {key:'locale',label:'Locale'}, {key:'attempt_count',label:'Attempts'}, {key:'last_error',label:'Last error'}, {key:'created_at',label:'Created'}],
    query: 'SELECT job_type, status, market_code, locale, attempt_count, last_error, created_at FROM product_factory_jobs ORDER BY created_at DESC LIMIT 50',
  },
  markets: {
    title: 'Global markets', eyebrow: 'COUNTRIES, LANGUAGES & CURRENCIES',
    description: 'Review configured storefront markets and their default currency and locale. This view does not perform payment conversion or change live market settings.',
    columns: [{key:'code',label:'Code'}, {key:'country_name',label:'Country'}, {key:'currency_code',label:'Currency'}, {key:'locale',label:'Locale'}, {key:'enabled',label:'Enabled'}],
    query: 'SELECT code, country_name, currency_code, locale, enabled FROM markets ORDER BY country_name LIMIT 100',
  },
  analytics: {
    title: 'Analytics & reports', eyebrow: 'MARKETPLACE PERFORMANCE',
    description: 'Database-backed operational totals. Pending orders are shown separately and are not represented as paid revenue.',
    columns: [{key:'metric',label:'Metric'}, {key:'value',label:'Value'}],
    query: `SELECT 'Registered users' AS metric, COUNT(*)::text AS value FROM users UNION ALL SELECT 'Products' AS metric, COUNT(*)::text AS value FROM products UNION ALL SELECT 'Orders' AS metric, COUNT(*)::text AS value FROM orders UNION ALL SELECT 'Paid orders' AS metric, COUNT(*)::text AS value FROM orders WHERE status = 'paid' UNION ALL SELECT 'Pending orders' AS metric, COUNT(*)::text AS value FROM orders WHERE status = 'pending' UNION ALL SELECT 'Paid gross by currency (minor units)' AS metric, COALESCE(string_agg(currency_code || ': ' || amount::text, ', ' ORDER BY currency_code), '—') AS value FROM (SELECT currency_code, SUM(total_minor)::bigint AS amount FROM orders WHERE status = 'paid' GROUP BY currency_code) paid_totals`,
  },
  activity: {
    title: 'Audit & activity', eyebrow: 'SECURITY & CHANGE HISTORY',
    description: 'Review recorded administrative events. Only events written by existing application workflows appear here.',
    columns: [{key:'action',label:'Action'}, {key:'resource_type',label:'Resource'}, {key:'resource_id',label:'Resource ID'}, {key:'result',label:'Result'}, {key:'created_at',label:'Time'}],
    query: 'SELECT action, resource_type, resource_id, result, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 50',
  },
};
const navigation: { href: string; label: string; roles: string[] }[] = [
  {href:'/admin',label:'Overview',roles:['Super Admin','Operations Admin','Catalog Manager','Finance Manager','Support Agent','AI Factory Manager','Read-Only Analyst']},
  {href:'/admin/catalog',label:'Products',roles:['Super Admin','Operations Admin','Catalog Manager']}, {href:'/admin/users',label:'Users',roles:['Super Admin','Operations Admin','Support Agent']},
  {href:'/admin/orders',label:'Orders & Finance',roles:['Super Admin','Operations Admin','Finance Manager']}, {href:'/admin/factory',label:'AI Product Factory',roles:['Super Admin','AI Factory Manager']},
  {href:'/admin/markets',label:'Global Markets',roles:['Super Admin','Operations Admin']}, {href:'/admin/analytics',label:'Analytics',roles:['Super Admin','Operations Admin','Finance Manager','Read-Only Analyst']}, {href:'/admin/activity',label:'Audit & Activity',roles:['Super Admin','Operations Admin']},
];

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!Object.prototype.hasOwnProperty.call(sections, section)) notFound();
  const key = section as SectionKey;
  const page = sections[key];
  const session = await auth();
  if (!session?.user) redirect('/admin/login');
  const roles = await db.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name IN ('Super Admin','Operations Admin','Catalog Manager','Finance Manager','Support Agent','AI Factory Manager','Read-Only Analyst')
     ORDER BY CASE WHEN r.name = 'Super Admin' THEN 0 ELSE 1 END, r.name`,
    [session.user.id],
  );
  if (!roles.rowCount) redirect('/account');
  const roleNames = new Set<string>(roles.rows.map((row: { name: string }) => String(row.name)));
  const allowedRoles: Record<SectionKey, string[]> = {
    catalog: ['Super Admin', 'Operations Admin', 'Catalog Manager'],
    users: ['Super Admin', 'Operations Admin', 'Support Agent'],
    orders: ['Super Admin', 'Operations Admin', 'Finance Manager'],
    factory: ['Super Admin', 'AI Factory Manager'],
    markets: ['Super Admin', 'Operations Admin'],
    analytics: ['Super Admin', 'Operations Admin', 'Finance Manager', 'Read-Only Analyst'],
    activity: ['Super Admin', 'Operations Admin'],
  };
  if (!allowedRoles[key].some((role) => roleNames.has(role))) redirect('/account');
  const roleLabel = roles.rows.map((row: { name: string }) => String(row.name)).join(', ');

  let rows: Record<string, unknown>[] = [];
  let loadError = false;
  try {
    const result = await db.query(page.query);
    rows = result.rows as Record<string, unknown>[];
  } catch (error) {
    loadError = true;
    console.error(`[admin:${key}] Unable to load section data`, error);
  }
  const fmt = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (value instanceof Date) return value.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const raw = String(value);
    if (raw.includes('T') && !Number.isNaN(Date.parse(raw))) return new Date(raw).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return raw.length > 90 ? raw.slice(0, 87) + '…' : raw;
  };

  return <main style={{minHeight:'100vh',background:'#f5f6fb',color:'#182033',fontFamily:'Arial,Helvetica,sans-serif',padding:'clamp(16px,3vw,36px)'}}>
    <div style={{maxWidth:1360,margin:'0 auto'}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flexWrap:'wrap',marginBottom:18}}>
        <Link href="/admin" style={{display:'inline-flex',gap:9,alignItems:'center',textDecoration:'none',color:'#30247e',fontWeight:850,fontSize:18}}><span style={{display:'grid',placeItems:'center',width:38,height:38,borderRadius:12,background:'#5143d8',color:'#fff'}}>D</span>DigiNanba <span style={{fontSize:10,letterSpacing:1.4,color:'#858ca0'}}>ADMIN</span></Link>
        <span style={{fontSize:12,color:'#6e778d'}}>Signed in as {session.user.name ?? session.user.email ?? 'Administrator'}</span>
      </header>
      <nav aria-label="Admin navigation" style={{display:'flex',gap:8,overflowX:'auto',padding:'5px 1px 17px',marginBottom:8}}>
        {navigation.filter(item => item.roles.some(role => roleNames.has(role))).map(item => <Link key={item.href} href={item.href} aria-current={item.href === `/admin/${key}` ? 'page' : undefined} style={{whiteSpace:'nowrap',textDecoration:'none',borderRadius:999,padding:'10px 13px',fontSize:12,fontWeight:750,background:item.href === `/admin/${key}` ? '#5143d8' : '#fff',color:item.href === `/admin/${key}` ? '#fff' : '#586176',border:'1px solid #e5e7f0'}}>{item.label}</Link>)}
      </nav>
      <section style={{background:'linear-gradient(120deg,#211b58,#5143d8)',color:'#fff',borderRadius:22,padding:'clamp(22px,3vw,34px)',marginBottom:22}}>
        <div style={{fontSize:11,letterSpacing:1.5,fontWeight:850,color:'#d9d4ff'}}>{page.eyebrow}</div>
        <h1 style={{fontSize:'clamp(27px,3.5vw,38px)',letterSpacing:-1,margin:'10px 0'}}>{page.title}</h1>
        <p style={{maxWidth:820,lineHeight:1.7,color:'#e3e0ff',margin:0}}>{page.description}</p>
      </section>
      <section style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,padding:20,marginBottom:18}}>
        <div><div style={{fontSize:12,color:'#7a8295',fontWeight:700}}>{key === 'analytics' ? 'METRICS AVAILABLE' : key === 'markets' ? 'MARKETS CONFIGURED' : key === 'factory' ? 'RECENT FACTORY JOBS' : key === 'activity' ? 'AUDIT EVENTS LOADED' : 'RECORDS LOADED'}</div><div style={{fontSize:32,fontWeight:850,marginTop:4}}>{loadError ? '—' : rows.length}</div></div>
        <div style={{fontSize:12,color:'#7a8295'}}>Showing up to {key === 'markets' || key === 'analytics' ? '100' : '50'} recent records · Read-only</div>
      </section>
      {key === 'orders' && <section style={{background:'#eef5ff',border:'1px solid #d6e5ff',borderRadius:16,padding:18,marginBottom:18,color:'#2b4b7a',fontSize:13,lineHeight:1.7}}>Financial amounts are stored in minor units (for example, cents or paise). Payment-provider confirmation and settlement reconciliation must be verified before these totals are treated as realized revenue.</section>}
      {key === 'factory' ? <FactoryControls /> : <section style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:'1px solid #edf0f5',fontWeight:800}}>{key === 'analytics' ? 'Operational metrics' : key === 'factory' ? 'Recent factory jobs' : key === 'activity' ? 'Recent audit events' : key === 'markets' ? 'Configured markets' : 'Recent records'}</div>
        {loadError ? <div style={{padding:24,color:'#a23a3a'}}>This section could not load its database records. The page remains available; check the table migration and deployment runtime logs.</div> : rows.length === 0 ? <div style={{padding:24,color:'#7a8295'}}>No records are available to display yet.</div> : <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:13,minWidth:560}}><thead><tr>{page.columns.map(col=><th key={col.key} style={{textAlign:'left',padding:'13px 16px',background:'#fafbfe',color:'#687187',fontSize:11,letterSpacing:.5,borderBottom:'1px solid #edf0f5'}}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={String(row.id ?? row.email ?? row.metric ?? i)}>{page.columns.map(col=><td key={col.key} style={{padding:'14px 16px',borderBottom:'1px solid #f0f2f6',color:col.key==='status' || col.key==='result'?'#087f65':'#30394c',maxWidth:360,overflowWrap:'anywhere'}}>{fmt(row[col.key])}</td>)}</tr>)}</tbody></table></div>}
      </section>}
      <footer style={{marginTop:18,color:'#8991a3',fontSize:11}}>DigiNanba private administration · Access role: {roleLabel}</footer>
    </div>
  </main>;
}
