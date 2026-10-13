import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';

type SectionKey = 'catalog' | 'users' | 'orders' | 'factory';
const config: Record<SectionKey, { title: string; eyebrow: string; description: string; table: 'products' | 'users' | 'orders' | 'categories'; columns: { key: string; label: string }[] }> = {
  catalog: { title: 'Catalog management', eyebrow: 'PRODUCTS & CATEGORIES', description: 'Review digital product listings and their publishing status. This view is read-only for now.', table: 'products', columns: [{key:'title',label:'Product'}, {key:'product_type',label:'Type'}, {key:'status',label:'Status'}, {key:'created_at',label:'Created'}] },
  users: { title: 'Users & access', eyebrow: 'ACCOUNTS & PERMISSIONS', description: 'Review marketplace accounts. Passwords and authentication secrets are never displayed here.', table: 'users', columns: [{key:'display_name',label:'Name'}, {key:'email',label:'Email'}, {key:'status',label:'Status'}, {key:'created_at',label:'Registered'}] },
  orders: { title: 'Orders & finance', eyebrow: 'ORDERS & SETTLEMENTS', description: 'Review order status and totals. Payment settlement actions are not enabled in this view.', table: 'orders', columns: [{key:'id',label:'Order ID'}, {key:'status',label:'Status'}, {key:'currency_code',label:'Currency'}, {key:'total_minor',label:'Total (minor units)'}, {key:'created_at',label:'Created'}] },
  factory: { title: 'AI Product Factory', eyebrow: 'AUTOMATION & AI', description: 'Review the current foundation and product catalog. Job controls remain unavailable until the factory workflow and permissions are verified.', table: 'products', columns: [{key:'title',label:'Product'}, {key:'product_type',label:'Type'}, {key:'status',label:'Status'}, {key:'created_at',label:'Created'}] },
};

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!['catalog','users','orders','factory'].includes(section)) notFound();
  const key = section as SectionKey;
  const page = config[key];
  const session = await auth();
  if (!session?.user) redirect('/admin/login');
  const roles = await db.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name IN ('Super Admin','Operations Admin','Catalog Manager','Finance Manager','Support Agent','AI Factory Manager','Read-Only Analyst')
     ORDER BY CASE WHEN r.name = 'Super Admin' THEN 0 ELSE 1 END LIMIT 1`,
    [session.user.id],
  );
  if (!roles.rowCount) redirect('/account');

  let rows: Record<string, unknown>[] = [];
  let loadError = false;
  try {
    const selected = page.columns.map((column) => column.key).join(', ');
    const orderBy = key === 'catalog' || key === 'factory' ? 'created_at DESC' : 'created_at DESC';
    const result = await db.query(`SELECT ${selected} FROM ${page.table} ORDER BY ${orderBy} LIMIT 50`);
    rows = result.rows as Record<string, unknown>[];
  } catch {
    loadError = true;
  }
  const count = rows.length;
  const fmt = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (value instanceof Date) return value.toLocaleString('en-IN', { dateStyle: 'medium' });
    const raw = String(value);
    if (raw.includes('T') && !Number.isNaN(Date.parse(raw))) return new Date(raw).toLocaleString('en-IN', { dateStyle: 'medium' });
    return raw.length > 42 ? raw.slice(0, 8) + '…' : raw;
  };

  return <main style={{minHeight:'100vh',background:'#f5f6fb',color:'#182033',fontFamily:'Arial,Helvetica,sans-serif',padding:'clamp(18px,4vw,42px)'}}>
    <div style={{maxWidth:1240,margin:'0 auto'}}>
      <Link href="/admin" style={{display:'inline-flex',gap:8,alignItems:'center',textDecoration:'none',color:'#5b4be7',fontWeight:750,fontSize:13,marginBottom:24}}>← Back to Admin Console</Link>
      <section style={{background:'linear-gradient(120deg,#211b58,#5143d8)',color:'#fff',borderRadius:22,padding:'clamp(22px,3vw,34px)',marginBottom:22}}>
        <div style={{fontSize:11,letterSpacing:1.5,fontWeight:850,color:'#d9d4ff'}}>{page.eyebrow}</div>
        <h1 style={{fontSize:'clamp(27px,3.5vw,38px)',letterSpacing:-1,margin:'10px 0'}}>{page.title}</h1>
        <p style={{maxWidth:720,lineHeight:1.7,color:'#e3e0ff',margin:0}}>{page.description}</p>
      </section>
      <section style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,padding:20,marginBottom:18}}>
        <div><div style={{fontSize:12,color:'#7a8295',fontWeight:700}}>RECORDS LOADED</div><div style={{fontSize:32,fontWeight:850,marginTop:4}}>{loadError ? '—' : count}</div></div>
        <div style={{fontSize:12,color:'#7a8295'}}>Showing up to 50 recent records · Read-only</div>
      </section>
      {key === 'factory' && <section style={{background:'#fff8e9',border:'1px solid #f5dfad',borderRadius:16,padding:18,marginBottom:18,color:'#805319',fontSize:13,lineHeight:1.7}}><strong>Factory controls are not active.</strong> This page intentionally does not start or delete jobs. The job queue, status tracking, and safe retry controls must be connected and verified before they are exposed.</section>}
      <section style={{background:'#fff',border:'1px solid #e7e9f1',borderRadius:18,overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:'1px solid #edf0f5',fontWeight:800}}>Recent records</div>
        {loadError ? <div style={{padding:24,color:'#a23a3a'}}>This table could not be loaded. Check the production database schema and runtime logs.</div> : rows.length === 0 ? <div style={{padding:24,color:'#7a8295'}}>No records are available to display.</div> : <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:13,minWidth:560}}><thead><tr>{page.columns.map(col=><th key={col.key} style={{textAlign:'left',padding:'13px 16px',background:'#fafbfe',color:'#687187',fontSize:11,letterSpacing:.5,borderBottom:'1px solid #edf0f5'}}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={String(row.id ?? row.email ?? i)}>{page.columns.map(col=><td key={col.key} style={{padding:'14px 16px',borderBottom:'1px solid #f0f2f6',color:col.key==='status'?'#087f65':'#30394c',maxWidth:320,overflowWrap:'anywhere'}}>{fmt(row[col.key])}</td>)}</tr>)}</tbody></table></div>}
      </section>
      <footer style={{marginTop:18,color:'#8991a3',fontSize:11}}>DigiNanba private administration · Access role: {String(roles.rows[0]?.name ?? 'Administrator')}</footer>
    </div>
  </main>;
}
