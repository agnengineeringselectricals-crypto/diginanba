import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

type Search = { period?: string; from?: string; to?: string };
type Metric = { key: string; title: string; totalSql: string; trendSql: string; note: string; money?: boolean };
const metrics: Metric[] = [
  { key: 'products', title: 'Products', totalSql: 'SELECT COUNT(*)::int AS total FROM products', trendSql: 'SELECT date_trunc($1, created_at)::date AS bucket, COUNT(*)::int AS value FROM products WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1', note: 'Total catalogue products and newly created products.' },
  { key: 'users', title: 'Registered users', totalSql: 'SELECT COUNT(*)::int AS total FROM users', trendSql: 'SELECT date_trunc($1, created_at)::date AS bucket, COUNT(*)::int AS value FROM users WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1', note: 'All registered accounts and new registrations.' },
  { key: 'orders', title: 'Orders', totalSql: 'SELECT COUNT(*)::int AS total FROM orders', trendSql: 'SELECT date_trunc($1, created_at)::date AS bucket, COUNT(*)::int AS value FROM orders WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1', note: 'All recorded orders and orders created in the selected period.' },
  { key: 'revenue', title: 'Paid order value', totalSql: "SELECT COALESCE(SUM(total_minor),0)::bigint AS total FROM orders WHERE status = 'paid'", trendSql: "SELECT date_trunc($1, created_at)::date AS bucket, COALESCE(SUM(total_minor),0)::bigint AS value FROM orders WHERE status = 'paid' AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1", note: 'Paid orders only; totals are shown in minor units by currency.', money: true },
  { key: 'categories', title: 'Categories', totalSql: 'SELECT COUNT(*)::int AS total FROM categories', trendSql: 'SELECT date_trunc($1, created_at)::date AS bucket, COUNT(*)::int AS value FROM products WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1', note: 'Current category total; trend shows products added over time.' },
  { key: 'factory', title: 'AI factory jobs', totalSql: 'SELECT COUNT(*)::int AS total FROM product_factory_jobs', trendSql: 'SELECT date_trunc($1, created_at)::date AS bucket, COUNT(*)::int AS value FROM product_factory_jobs WHERE created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 1', note: 'Factory jobs created over time.' },
];
const periods = ['day', 'week', 'month', 'year', 'custom'] as const;
function validDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined; }
function dateOnly(d: Date) { return d.toISOString().slice(0, 10); }
function shiftDays(d: Date, days: number) { const n = new Date(d); n.setUTCDate(n.getUTCDate() + days); return n; }
function moneyLabel(minor: number) { return (minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

export default async function BusinessAnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await auth();
  if (!session?.user) redirect('/admin/login');
  const roleResult = await db.query(`SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name IN ('Super Admin','Operations Admin','Finance Manager','Read-Only Analyst')`, [session.user.id]);
  if (!roleResult.rowCount) redirect('/account');
  const params = await searchParams;
  const period = periods.includes(params.period as typeof periods[number]) ? params.period as typeof periods[number] : 'month';
  const now = new Date();
  const to = validDate(params.to) ?? dateOnly(shiftDays(now, 1));
  const defaults: Record<string, number> = { day: 1, week: 7, month: 30, year: 365, custom: 30 };
  const from = period === 'custom' ? validDate(params.from) ?? dateOnly(shiftDays(now, -29)) : dateOnly(shiftDays(new Date(to + 'T00:00:00Z'), -defaults[period]));
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const trunc = days <= 2 ? 'day' : days <= 45 ? 'day' : days <= 120 ? 'week' : 'month';
  const moneyTotals: Record<string, number> = {};
  try {
    const result = await db.query("SELECT currency_code, COALESCE(SUM(total_minor),0)::bigint AS total FROM orders WHERE status='paid' GROUP BY currency_code ORDER BY currency_code");
    for (const row of result.rows) moneyTotals[String(row.currency_code)] = Number(row.total);
  } catch {}
  const datasets = await Promise.all(metrics.map(async (metric) => {
    try {
      const [totalResult, trendResult] = await Promise.all([
        db.query(metric.totalSql),
        db.query(metric.trendSql, [trunc, start.toISOString(), end.toISOString()]),
      ]);
      return { ...metric, total: Number(totalResult.rows[0]?.total ?? 0), points: trendResult.rows.map((row: { bucket: Date | string; value: number | string }) => ({ label: new Date(row.bucket).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }), value: Number(row.value) })), error: false };
    } catch (error) {
      console.error('[admin:business-analytics] query failed', metric.key, error);
      return { ...metric, total: 0, points: [], error: true };
    }
  }));
  const currencySummary = Object.entries(moneyTotals).map(([currency, amount]) => currency + ' ' + moneyLabel(amount)).join(' · ') || 'No paid orders recorded';
  const nav = [{ href: '/admin', label: 'Overview' }, { href: '/admin/business', label: 'Business analytics' }, { href: '/admin/catalog', label: 'Products' }, { href: '/admin/users', label: 'Users' }, { href: '/admin/orders', label: 'Orders & Finance' }, { href: '/admin/factory', label: 'AI Product Factory' }, { href: '/admin/markets', label: 'Global Markets' }, { href: '/admin/analytics', label: 'Analytics' }];
  return <main style={{ minHeight: '100vh', background: '#f5f6fb', color: '#182033', fontFamily: 'Arial,Helvetica,sans-serif', padding: 'clamp(16px,3vw,36px)' }}>
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <Link href="/admin" style={{ textDecoration: 'none', color: '#30247e', fontWeight: 850, fontSize: 19 }}>DigiNanba · ADMIN</Link><span style={{ fontSize: 12, color: '#6e778d' }}>Business overview · Production data</span>
      </header>
      <nav aria-label="Admin navigation" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '5px 1px 17px' }}>{nav.map(n => <Link key={n.href} href={n.href} style={{ whiteSpace: 'nowrap', textDecoration: 'none', borderRadius: 999, padding: '10px 13px', fontSize: 12, fontWeight: 750, background: n.href === '/admin/business' ? '#5143d8' : '#fff', color: n.href === '/admin/business' ? '#fff' : '#586176', border: '1px solid #e5e7f0' }}>{n.label}</Link>)}</nav>
      <section style={{ background: 'linear-gradient(120deg,#211b58,#5143d8)', color: '#fff', borderRadius: 22, padding: 'clamp(22px,3vw,34px)', marginBottom: 20 }}>
        <div style={{ color: '#d9d4ff', fontSize: 11, fontWeight: 850, letterSpacing: 1.5 }}>BUSINESS INTELLIGENCE</div><h1 style={{ fontSize: 'clamp(27px,3.5vw,38px)', margin: '10px 0' }}>Business dashboard</h1><p style={{ color: '#e3e0ff', lineHeight: 1.7, margin: 0 }}>Track business activity, catalogue growth, account registrations, orders and paid order value across your selected period.</p>
      </section>
      <form method="GET" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 12, background: '#fff', border: '1px solid #e7e9f1', borderRadius: 18, padding: 18, marginBottom: 20 }}>
        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750, color: '#626c82' }}>Reporting period<select name="period" defaultValue={period} style={{ minHeight: 42, minWidth: 160, padding: '0 12px', border: '1px solid #dfe3ee', borderRadius: 9, background: '#fff', color: '#182033' }}>{periods.map(p => <option key={p} value={p}>{p === 'day' ? 'Daily · today' : p === 'week' ? 'Weekly · last 7 days' : p === 'month' ? 'Monthly · last 30 days' : p === 'year' ? 'Yearly · last 365 days' : 'Custom date range'}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750, color: '#626c82' }}>From<input type="date" name="from" defaultValue={period === 'custom' ? from : undefined} style={{ minHeight: 42, padding: '0 10px', border: '1px solid #dfe3ee', borderRadius: 9 }} /></label>
        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750, color: '#626c82' }}>To (exclusive)<input type="date" name="to" defaultValue={period === 'custom' ? to : undefined} style={{ minHeight: 42, padding: '0 10px', border: '1px solid #dfe3ee', borderRadius: 9 }} /></label>
        <button type="submit" style={{ minHeight: 42, border: 0, borderRadius: 9, padding: '0 20px', color: '#fff', background: '#5143d8', fontWeight: 800, cursor: 'pointer' }}>Apply range</button>
        <span style={{ fontSize: 11, color: '#8991a3' }}>Showing {from} through the day before {to}. All dates use UTC database timestamps.</span>
      </form>
      <section style={{ background: '#fff', border: '1px solid #e7e9f1', borderRadius: 16, padding: 18, marginBottom: 20 }}><div style={{ fontSize: 12, color: '#7a8295', fontWeight: 800 }}>PAID ORDER VALUE · ALL TIME</div><div style={{ marginTop: 8, fontSize: 21, fontWeight: 850 }}>{currencySummary}</div><p style={{ margin: '8px 0 0', fontSize: 12, color: '#7a8295' }}>Currency totals are kept separate; amounts are not converted between USD, GBP and INR. Demo or pending orders are not counted as paid revenue.</p></section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        {datasets.map(d => { const max = Math.max(1, ...d.points.map(p => p.value)); return <article key={d.key} style={{ background: '#fff', border: '1px solid #e7e9f1', borderRadius: 18, padding: 19, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}><div><h2 style={{ margin: 0, fontSize: 17 }}>{d.title}</h2><p style={{ margin: '6px 0 0', color: '#7a8295', fontSize: 12, lineHeight: 1.5 }}>{d.note}</p></div><span style={{ background: '#f0edff', color: '#5143d8', borderRadius: 10, padding: '7px 9px', fontSize: 10, fontWeight: 850 }}>LIVE</span></div>
          <div style={{ fontSize: 32, fontWeight: 850, letterSpacing: -1, margin: '18px 0 14px' }}>{d.error ? '—' : d.key === 'revenue' ? 'By currency ↓' : d.total.toLocaleString('en-IN')}</div>
          {d.key === 'revenue' ? <p style={{ margin: '0 0 12px', fontSize: 12, color: '#5143d8', fontWeight: 800 }}>See all-time currency totals above; the graph below shows paid amount in minor units.</p> : null}
          {d.error ? <p style={{ color: '#a23a3a', fontSize: 12 }}>This metric could not be loaded. Check database schema and server logs.</p> : d.points.length === 0 ? <p style={{ color: '#8991a3', fontSize: 12 }}>No activity in this period.</p> : <div role="img" aria-label={d.title + ' activity graph'} style={{ display: 'flex', alignItems: 'end', gap: 5, height: 126, overflowX: 'auto', padding: '8px 2px 0', borderBottom: '1px solid #e9ecf4' }}>{d.points.map((p, i) => <div key={p.label + i} title={p.label + ': ' + p.value.toLocaleString('en-IN')} style={{ flex: '1 0 12px', minWidth: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'end', height: '100%' }}><span style={{ fontSize: 9, color: '#6f7890', marginBottom: 3 }}>{p.value ? p.value.toLocaleString('en-IN') : ''}</span><div style={{ width: '100%', maxWidth: 26, height: Math.max(3, p.value / max * 82), background: '#7162ee', borderRadius: '4px 4px 0 0' }} /></div>)}</div>}
          {d.points.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, color: '#8991a3', fontSize: 10 }}><span>{d.points[0].label}</span><span>{d.points[d.points.length - 1].label}</span></div>}
        </article>; })}
      </section>
      <section style={{ marginTop: 20, padding: 18, background: '#fff9e8', border: '1px solid #f1dfad', borderRadius: 16, color: '#765517', fontSize: 13, lineHeight: 1.7 }}><strong>Creator and subscriber reporting:</strong> the current database schema records general registered users, but does not yet have separate creator/subscriber account-type fields or a subscription table. This dashboard therefore does not invent those counts. Once those entities are implemented, they can be added as dedicated metrics. Revenue is reported from orders marked paid only, and separated by currency.</section>
      <footer style={{ marginTop: 20, color: '#8991a3', fontSize: 11 }}>DigiNanba admin · Access restricted to authorized analytics roles · Counts and trends come from database records.</footer>
    </div>
  </main>;
}
