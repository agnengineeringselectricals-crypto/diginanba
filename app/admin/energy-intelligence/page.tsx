import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

type Summary = { sites: number; substations: number; gateways: number; meters: number; readings24h: number; openAlerts: number };
type Latest = { site_name: string; substation_name: string; meter_code: string; manufacturer: string | null; model: string | null; metric_code: string; metric_value: string; unit: string; measured_at: string; quality: string };

const emptySummary: Summary = { sites: 0, substations: 0, gateways: 0, meters: 0, readings24h: 0, openAlerts: 0 };

export default async function EnergyIntelligencePage() {
  const session = await auth();
  if (!session?.user) redirect('/admin/login');
  const access = await db.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     WHERE ur.user_id=$1 AND r.name IN ('Super Admin','Operations Admin','Read-Only Analyst')`,
    [session.user.id],
  );
  if (!access.rowCount) redirect('/account');

  let summary = emptySummary;
  let latest: Latest[] = [];
  let health: { gateway_code: string; model: string | null; status: string; last_seen_at: string | null; substation_name: string | null }[] = [];
  let configured = true;
  try {
    const [counts, latestResult, healthResult] = await Promise.all([
      db.query(`SELECT
        (SELECT COUNT(*)::int FROM iot.sites) sites,
        (SELECT COUNT(*)::int FROM iot.substations) substations,
        (SELECT COUNT(*)::int FROM iot.gateways) gateways,
        (SELECT COUNT(*)::int FROM iot.meters) meters,
        (SELECT COUNT(*)::int FROM iot.measurements WHERE received_at >= now()-interval '24 hours') readings24h,
        (SELECT COUNT(*)::int FROM iot.alerts WHERE status='open') openAlerts`),
      db.query(`SELECT s.name site_name, ss.name substation_name, m.meter_code, m.manufacturer, m.model,
        x.metric_code, x.metric_value::text, x.unit, x.measured_at::text, x.quality
        FROM iot.measurements x JOIN iot.sites s ON s.id=x.site_id
        JOIN iot.substations ss ON ss.id=x.substation_id JOIN iot.meters m ON m.id=x.meter_id
        ORDER BY x.measured_at DESC LIMIT 12`),
      db.query(`SELECT g.gateway_code,g.model,g.status,g.last_seen_at::text,ss.name substation_name
        FROM iot.gateways g LEFT JOIN iot.substations ss ON ss.id=g.substation_id
        ORDER BY g.gateway_code LIMIT 12`),
    ]);
    summary = counts.rows[0] as Summary;
    latest = latestResult.rows as Latest[];
    health = healthResult.rows;
  } catch (error) {
    configured = false;
    console.error('[iot:dashboard] schema unavailable', error);
  }

  const cards = [
    ['Sites', summary.sites, 'Factory locations'],
    ['Substations', summary.substations, 'Registered substations'],
    ['Gateways', summary.gateways, 'IoT communication units'],
    ['Meters', summary.meters, 'Registered energy meters'],
    ['Readings · 24h', summary.readings24h, 'Received telemetry points'],
    ['Open alerts', summary.openAlerts, 'Unresolved notifications'],
  ] as const;
  const styles = `
    .ei-shell{max-width:1500px;margin:0 auto;padding:30px 34px 54px;color:#17233b;font-family:Arial,Helvetica,sans-serif}
    .ei-hero{border-radius:24px;padding:28px;background:linear-gradient(120deg,#102c52,#174e73 55%,#167b82);color:white;display:flex;justify-content:space-between;gap:20px;align-items:center}
    .ei-kicker{font-size:11px;letter-spacing:1.8px;font-weight:800;opacity:.8}
    .ei-title{font-size:30px;font-weight:850;letter-spacing:-.8px;margin:8px 0}
    .ei-sub{font-size:14px;line-height:1.6;max-width:720px;color:#d9eaf2}
    .ei-badge{border:1px solid #ffffff45;background:#ffffff17;padding:9px 12px;border-radius:999px;font-size:12px;font-weight:750;white-space:nowrap}
    .ei-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0}
    .ei-card,.ei-panel{background:white;border:1px solid #e5eaf0;border-radius:18px;padding:19px;box-shadow:0 5px 20px #102c5208}
    .ei-label{font-size:12px;color:#66758a;font-weight:700}
    .ei-value{font-size:28px;font-weight:850;margin-top:9px;color:#172b49}
    .ei-note{font-size:12px;color:#8a97a8;margin-top:4px}
    .ei-columns{display:grid;grid-template-columns:1.35fr 1fr;gap:16px}
    .ei-panel h2{font-size:17px;margin:0 0 14px}
    .ei-table{width:100%;border-collapse:collapse;font-size:12px}
    .ei-table th{text-align:left;color:#7c899a;font-size:10px;letter-spacing:.7px;padding:10px 7px;border-bottom:1px solid #edf0f4}
    .ei-table td{padding:12px 7px;border-bottom:1px solid #f0f2f6;color:#34435a}
    .ei-empty{padding:24px 16px;border:1px dashed #ccd7e2;background:#f8fafc;border-radius:14px;color:#63748a;font-size:13px;line-height:1.65}
    .ei-row{display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid #eef1f5;font-size:13px}
    .ei-status{font-size:11px;border-radius:999px;padding:5px 9px;background:#f1f5f9;color:#526174;font-weight:800}
    .ei-status.online{background:#e6f8ef;color:#147346}
    .ei-link{display:inline-flex;margin-top:16px;color:#175c87;font-weight:800;text-decoration:none;font-size:13px}
    @media(max-width:850px){.ei-columns{grid-template-columns:1fr}.ei-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:560px){.ei-shell{padding:16px 12px 32px}.ei-hero{padding:21px;display:block}.ei-title{font-size:25px}.ei-badge{display:inline-block;margin-top:14px}.ei-grid{gap:9px}.ei-card{padding:14px}.ei-value{font-size:24px}.ei-panel{padding:14px}.ei-table{min-width:570px}.ei-table-wrap{overflow-x:auto}}
  `;
  return <main className="ei-shell"><style>{styles}</style>
    <div style={{marginBottom:16}}><Link href="/admin" style={{color:'#52657b',fontSize:13,textDecoration:'none'}}>← Admin home</Link></div>
    <header className="ei-hero">
      <div><div className="ei-kicker">DIG INANBA · INDUSTRIAL IOT</div><div className="ei-title">Energy Intelligence</div>
        <div className="ei-sub">Monitor substations, energy meters, power quality, gateway connectivity and factory energy performance in one place.</div></div>
      <div className="ei-badge">{configured ? 'MONITORING WORKSPACE' : 'DATABASE SETUP REQUIRED'}</div>
    </header>
    {!configured && <div className="ei-empty" style={{marginTop:16}}>The IoT database migration has not been applied yet. The dashboard is ready to display data after the additive migration is deployed.</div>}
    <section className="ei-grid">{cards.map(([label,value,note])=><article className="ei-card" key={label}><div className="ei-label">{label}</div><div className="ei-value">{Number(value).toLocaleString('en-IN')}</div><div className="ei-note">{note}</div></article>)}</section>
    <section className="ei-columns">
      <article className="ei-panel"><h2>Latest meter readings</h2>
        {latest.length ? <div className="ei-table-wrap"><table className="ei-table"><thead><tr><th>SUBSTATION / METER</th><th>PARAMETER</th><th>VALUE</th><th>TIME</th><th>QUALITY</th></tr></thead><tbody>{latest.map((r,i)=><tr key={i}><td><strong>{r.substation_name}</strong><br/>{r.meter_code}</td><td>{r.metric_code}</td><td>{r.metric_value} {r.unit}</td><td>{new Date(r.measured_at).toLocaleString('en-IN')}</td><td>{r.quality}</td></tr>)}</tbody></table></div>
        : <div className="ei-empty">No meter readings have been received yet. After we identify and authorise the existing gateway, we'll register its meters and verify the first real readings here. No sample factory values are being displayed.</div>}
      </article>
      <article className="ei-panel"><h2>Gateway communication health</h2>
        {health.length ? health.map(g=><div className="ei-row" key={g.gateway_code}><div><strong>{g.gateway_code}</strong><div style={{color:'#8290a1',fontSize:11}}>{g.model || 'Model not recorded'} · {g.substation_name || 'Substation not assigned'}<br/>Last seen: {g.last_seen_at ? new Date(g.last_seen_at).toLocaleString('en-IN') : 'Never'}</div></div><span className={`ei-status ${g.status}`}>{g.status}</span></div>)
        : <div className="ei-empty">No gateways registered. Hardware discovery and configuration will be completed after the device model and network details are available.</div>}
        <h2 style={{marginTop:22}}>Initial rollout</h2>
        <div className="ei-row"><span>Substations planned</span><strong>6</strong></div>
        <div className="ei-row"><span>First connection</span><strong>1 gateway</strong></div>
        <div className="ei-row"><span>Operating mode</span><strong>Read-only</strong></div>
      </article>
    </section>
  </main>;
}
