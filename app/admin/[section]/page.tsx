import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import FactoryControls from '../FactoryControls';
import CatalogControls from '../CatalogControls';

type SectionKey = 'catalog' | 'users' | 'orders' | 'factory' | 'markets' | 'analytics' | 'activity';
type AdminSearch = { period?: string; from?: string; to?: string; segment?: string };
const periods = ['day','week','month','year','custom'] as const;
function dateOnly(d: Date) { return d.toISOString().slice(0,10); }
function shiftDays(d: Date, days: number) { const n = new Date(d); n.setUTCDate(n.getUTCDate()+days); return n; }
const trendQueries: Record<SectionKey, { title: string; total: string; trend: string; note: string }[]> = {
  catalog: [
    {title:'All products',total:'SELECT COUNT(*)::int AS n FROM products',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM products WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'Total products and newly added products'},
    {title:'Published products',total:"SELECT COUNT(*)::int AS n FROM products WHERE status='published'",trend:"SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM products WHERE status='published' AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1",note:'Published product records created in the selected period'},
    {title:'Categories',total:'SELECT COUNT(*)::int AS n FROM categories',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM categories WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'Total categories and newly created categories'},
  ],
  users: [
    {title:'Normal users',total:"SELECT COUNT(*)::int AS n FROM users u WHERE u.account_type='normal' AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=u.id AND s.status IN ('active','trialing'))",trend:"SELECT date_trunc($1,u.created_at)::date AS bucket,COUNT(*)::int AS n FROM users u WHERE u.account_type='normal' AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=u.id AND s.status IN ('active','trialing')) AND u.created_at >= $2 AND u.created_at < $3 GROUP BY 1 ORDER BY 1",note:'Regular marketplace accounts without an active subscription'},
    {title:'Creators',total:"SELECT COUNT(*)::int AS n FROM users WHERE account_type='creator'",trend:"SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM users WHERE account_type='creator' AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1",note:'Accounts explicitly marked as creators'},
    {title:'Subscribers',total:"SELECT COUNT(DISTINCT user_id)::int AS n FROM subscriptions WHERE status IN ('active','trialing')",trend:"SELECT date_trunc($1,created_at)::date AS bucket,COUNT(DISTINCT user_id)::int AS n FROM subscriptions WHERE status IN ('active','trialing') AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1",note:'Unique users with an active or trial subscription'},
  ],
  orders: [
    {title:'Orders',total:'SELECT COUNT(*)::int AS n FROM orders',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM orders WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'Total orders and newly placed orders'},
    {title:'Paid orders',total:"SELECT COUNT(*)::int AS n FROM orders WHERE status='paid'",trend:"SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM orders WHERE status='paid' AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1",note:'Orders marked paid; reconcile with payment provider'},
    {title:'Pending orders',total:"SELECT COUNT(*)::int AS n FROM orders WHERE status='pending'",trend:"SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM orders WHERE status='pending' AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1",note:'Orders currently pending that were created in the period'},
  ],
  factory: [
    {title:'Factory jobs',total:'SELECT COUNT(*)::int AS n FROM product_factory_jobs',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM product_factory_jobs WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'All factory jobs and jobs created in the period'},
    {title:'Failed jobs',total:"SELECT COUNT(*)::int AS n FROM product_factory_jobs WHERE status='failed'",trend:"SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM product_factory_jobs WHERE status='failed' AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1",note:'Failed jobs created in the selected period'},
  ],
  markets: [
    {title:'Enabled markets',total:'SELECT COUNT(*)::int AS n FROM markets WHERE enabled=true',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM markets WHERE enabled=true AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'Enabled markets and newly enabled-market records'},
  ],
  analytics: [
    {title:'Registered users',total:'SELECT COUNT(*)::int AS n FROM users',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM users WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'All accounts and new registrations'},
    {title:'Products',total:'SELECT COUNT(*)::int AS n FROM products',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM products WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'All products and new product records'},
    {title:'Orders',total:'SELECT COUNT(*)::int AS n FROM orders',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM orders WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'All orders and new order records'},
  ],
  activity: [
    {title:'Audit events',total:'SELECT COUNT(*)::int AS n FROM audit_logs',trend:'SELECT date_trunc($1,created_at)::date AS bucket,COUNT(*)::int AS n FROM audit_logs WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1',note:'Total recorded audit events and events in the period'},
  ],
};
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
    columns: [{key:'display_name',label:'Name'}, {key:'email',label:'Email'}, {key:'account_type',label:'Account type'}, {key:'status',label:'Status'}, {key:'created_at',label:'Registered'}],
    query: 'SELECT display_name, email, account_type, status, created_at FROM users ORDER BY created_at DESC LIMIT 50',
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
  {href:'/admin/business',label:'Business analytics',roles:['Super Admin','Operations Admin','Finance Manager','Read-Only Analyst']},
  {href:'/admin',label:'Overview',roles:['Super Admin','Operations Admin','Catalog Manager','Finance Manager','Support Agent','AI Factory Manager','Read-Only Analyst']},
  {href:'/admin/catalog',label:'Products',roles:['Super Admin','Operations Admin','Catalog Manager']}, {href:'/admin/users',label:'Users',roles:['Super Admin','Operations Admin','Support Agent']},
  {href:'/admin/orders',label:'Orders & Finance',roles:['Super Admin','Operations Admin','Finance Manager']}, {href:'/admin/factory',label:'AI Product Factory',roles:['Super Admin','AI Factory Manager']},
  {href:'/admin/markets',label:'Global Markets',roles:['Super Admin','Operations Admin']}, {href:'/admin/analytics',label:'Analytics',roles:['Super Admin','Operations Admin','Finance Manager','Read-Only Analyst']}, {href:'/admin/activity',label:'Audit & Activity',roles:['Super Admin','Operations Admin']},
];

export default async function AdminSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<AdminSearch> }) {
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
  const search = await searchParams;
  const period = periods.includes(search.period as typeof periods[number]) ? search.period as typeof periods[number] : 'month';
  const userSegments = ['all','normal','creators','subscribers'] as const;
  const userSegment = userSegments.includes(search.segment as typeof userSegments[number]) ? search.segment as typeof userSegments[number] : 'all';
  const today = new Date();
  const to = search.to && /^\\d{4}-\\d{2}-\\d{2}$/.test(search.to) ? search.to : dateOnly(shiftDays(today, 1));
  const daysByPeriod: Record<string, number> = {day:1,week:7,month:30,year:365,custom:30};
  const from = period === 'custom' && search.from && /^\\d{4}-\\d{2}-\\d{2}$/.test(search.from) ? search.from : dateOnly(shiftDays(new Date(to+'T00:00:00Z'), -daysByPeriod[period]));
  const rangeStart = new Date(from+'T00:00:00Z');
  const rangeEnd = new Date(to+'T00:00:00Z');
  const rangeDays = Math.max(1, Math.ceil((rangeEnd.getTime()-rangeStart.getTime())/86400000));
  const bucketSize = rangeDays <= 45 ? 'day' : rangeDays <= 120 ? 'week' : 'month';
  const metricsForPage = key === 'users' && userSegment !== 'all' ? trendQueries.users.filter(metric => ({normal:'Normal users',creators:'Creators',subscribers:'Subscribers'} as Record<string,string>)[userSegment] === metric.title) : trendQueries[key];
  const chartMetrics = await Promise.all(metricsForPage.map(async (metric) => {
    try {
      const [totalResult, trendResult] = await Promise.all([
        db.query(metric.total),
        db.query(metric.trend, [bucketSize, rangeStart.toISOString(), rangeEnd.toISOString()]),
      ]);
      return { ...metric, total: Number(totalResult.rows[0]?.n ?? 0), points: trendResult.rows.map((row: {bucket: Date|string; n: number|string}) => ({ label: new Date(row.bucket).toLocaleDateString('en-IN',{day:'2-digit',month:'short',timeZone:'UTC'}), value: Number(row.n) })), error: false };
    } catch (error) {
      console.error('[admin:section-analytics] metric failed', key, metric.title, error);
      return { ...metric, total: 0, points: [], error: true };
    }
  }));

  let rows: Record<string, unknown>[] = [];
  let loadError = false;
  try {
    const userQuery = key !== 'users' ? page.query : userSegment === 'normal'
      ? "SELECT u.display_name,u.email,u.account_type,u.status,u.created_at FROM users u WHERE u.account_type='normal' AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=u.id AND s.status IN ('active','trialing')) ORDER BY u.created_at DESC LIMIT 50"
      : userSegment === 'creators'
      ? "SELECT display_name,email,account_type,status,created_at FROM users WHERE account_type='creator' ORDER BY created_at DESC LIMIT 50"
      : userSegment === 'subscribers'
      ? "SELECT DISTINCT ON (u.id) u.display_name,u.email,u.account_type,u.status,u.created_at FROM users u JOIN subscriptions s ON s.user_id=u.id WHERE s.status IN ('active','trialing') ORDER BY u.id,s.created_at DESC LIMIT 50"
      : page.query;
    const result = await db.query(userQuery);
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
        <div><div style={{fontSize:12,color:'#7a8295',fontWeight:700}}>{key === 'analytics' ? 'METRICS AVAILABLE' : key === 'markets' ? 'MARKETS CONFIGURED' : key === 'activity' ? 'AUDIT EVENTS LOADED' : 'RECORDS LOADED'}</div><div style={{fontSize:32,fontWeight:850,marginTop:4}}>{loadError ? '—' : rows.length}</div></div>
        <div style={{fontSize:12,color:'#7a8295'}}>Showing up to {key === 'markets' || key === 'analytics' ? '100' : '50'} recent records · Read-only</div>
      </section>
      {key === 'users' && <section aria-label="User subcategories" style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:16,padding:14,marginBottom:18}}>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:1.1,color:'#778095',marginBottom:10}}>USER SUBCATEGORIES</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {[{id:'all',label:'All users'},{id:'normal',label:'Normal users'},{id:'creators',label:'Creators'},{id:'subscribers',label:'Subscribers'}].map(item=><Link key={item.id} href={`/admin/users?segment=${item.id}&period=${period}&from=${from}&to=${to}`} aria-current={userSegment===item.id?'page':undefined} style={{textDecoration:'none',padding:'10px 14px',borderRadius:999,border:'1px solid #e5e7f0',fontSize:12,fontWeight:800,background:userSegment===item.id?'#5143d8':'#fff',color:userSegment===item.id?'#fff':'#586176'}}>{item.label}</Link>)}
        </div>
      </section>}
      <section style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,padding:18,marginBottom:18}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}><div><h2 style={{margin:0,fontSize:19}}>Period analytics</h2><p style={{margin:'5px 0 0',fontSize:12,color:'#778095'}}>Current totals and activity over time for {page.title.toLowerCase()}.</p></div><form method="GET" style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>
          <label style={{display:'grid',gap:4,fontSize:11,color:'#687187'}}>Period<select name="period" defaultValue={period} style={{padding:'9px 10px',border:'1px solid #dfe3ed',borderRadius:8,background:'#fff'}}>{periods.map(p=><option key={p} value={p}>{p==='day'?'Daily · today':p==='week'?'Weekly · 7 days':p==='month'?'Monthly · 30 days':p==='year'?'Yearly · 365 days':'Custom range'}</option>)}</select></label>
          <label style={{display:'grid',gap:4,fontSize:11,color:'#687187'}}>From<input type="date" name="from" defaultValue={period==='custom'?from:undefined} style={{padding:'8px',border:'1px solid #dfe3ed',borderRadius:8}} /></label>
          <label style={{display:'grid',gap:4,fontSize:11,color:'#687187'}}>To (exclusive)<input type="date" name="to" defaultValue={period==='custom'?to:undefined} style={{padding:'8px',border:'1px solid #dfe3ed',borderRadius:8}} /></label>
          <button type="submit" style={{padding:'10px 14px',border:0,borderRadius:8,background:'#5143d8',color:'#fff',fontWeight:800,cursor:'pointer'}}>Apply</button>
        </form></div>
        <p style={{fontSize:11,color:'#8991a3',margin:'0 0 14px'}}>Range: {from} through the day before {to}. For longer ranges, graphs group activity by week or month.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>
          {chartMetrics.map(metric=>{const max=Math.max(1,...metric.points.map(p=>p.value));return <article key={metric.title} style={{border:'1px solid #edf0f5',borderRadius:14,padding:15,minWidth:0}}>
            <h3 style={{fontSize:15,margin:'0 0 5px'}}>{metric.title}</h3><p style={{fontSize:11,color:'#778095',lineHeight:1.5,margin:'0 0 10px'}}>{metric.note}</p>
            <div style={{fontSize:29,fontWeight:850,marginBottom:12}}>{metric.error?'—':metric.total.toLocaleString('en-IN')}</div>
            {metric.error?<p style={{fontSize:12,color:'#a23a3a'}}>Metric unavailable: check database schema.</p>:metric.points.length===0?<p style={{fontSize:12,color:'#8991a3'}}>No activity in this period.</p>:<div role="img" aria-label={metric.title+' activity graph'} style={{height:108,display:'flex',alignItems:'end',gap:4,overflowX:'auto',borderBottom:'1px solid #edf0f5',padding:'4px 1px 0'}}>{metric.points.map((p,i)=><div key={p.label+i} title={p.label+': '+p.value} style={{flex:'1 0 10px',minWidth:10,height:'100%',display:'flex',flexDirection:'column',justifyContent:'end',alignItems:'center'}}><span style={{fontSize:9,color:'#778095'}}>{p.value||''}</span><div style={{height:Math.max(3,p.value/max*70),width:'100%',maxWidth:22,background:'#7162ee',borderRadius:'3px 3px 0 0'}}/></div>)}</div>}
            {metric.points.length>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#8991a3',marginTop:7}}><span>{metric.points[0].label}</span><span>{metric.points[metric.points.length-1].label}</span></div>}
          </article>})}
        </div>
        {key==='users'&&<p style={{margin:'14px 0 0',fontSize:12,color:'#765517',background:'#fff9e8',padding:12,borderRadius:10}}>Normal users are accounts marked normal without an active/trial subscription. Creator counts use the explicit users.account_type field. Subscriber counts use active/trialing subscription records. Run the new Neon migration before using these metrics; existing accounts default to normal and are not automatically classified as creators or subscribers.</p>}
        {key==='markets'&&<p style={{margin:'14px 0 0',fontSize:12,color:'#765517',background:'#fff9e8',padding:12,borderRadius:10}}>If the markets table does not store created_at, its growth graph will show unavailable; the enabled-market total remains independently useful.</p>}
      </section>
      {key === 'orders' && <section style={{background:'#eef5ff',border:'1px solid #d6e5ff',borderRadius:16,padding:18,marginBottom:18,color:'#2b4b7a',fontSize:13,lineHeight:1.7}}>Financial amounts are stored in minor units (for example, cents or paise). Payment-provider confirmation and settlement reconciliation must be verified before these totals are treated as realized revenue.</section>}
      {key === 'factory' ? <FactoryControls /> : key === 'catalog' ? <CatalogControls /> : <section style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:'1px solid #edf0f5',fontWeight:800}}>{key === 'analytics' ? 'Operational metrics' : key === 'activity' ? 'Recent audit events' : key === 'markets' ? 'Configured markets' : 'Recent records'}</div>
        {loadError ? <div style={{padding:24,color:'#a23a3a'}}>This section could not load its database records. The page remains available; check the table migration and deployment runtime logs.</div> : rows.length === 0 ? <div style={{padding:24,color:'#7a8295'}}>No records are available to display yet.</div> : <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:13,minWidth:560}}><thead><tr>{page.columns.map(col=><th key={col.key} style={{textAlign:'left',padding:'13px 16px',background:'#fafbfe',color:'#687187',fontSize:11,letterSpacing:.5,borderBottom:'1px solid #edf0f5'}}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={String(row.id ?? row.email ?? row.metric ?? i)}>{page.columns.map(col=><td key={col.key} style={{padding:'14px 16px',borderBottom:'1px solid #f0f2f6',color:col.key==='status' || col.key==='result'?'#087f65':'#30394c',maxWidth:360,overflowWrap:'anywhere'}}>{fmt(row[col.key])}</td>)}</tr>)}</tbody></table></div>}
      </section>}
      <footer style={{marginTop:18,color:'#8991a3',fontSize:11}}>DigiNanba private administration · Access role: {roleLabel}</footer>
    </div>
  </main>;
}
