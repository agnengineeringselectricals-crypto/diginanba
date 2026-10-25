import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

type LoginEvent = { occurred_at: string; ip_address: string | null; country_code: string | null; region: string | null; city: string | null; user_agent: string | null; login_method: string | null };

export default async function AccountSecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/account/security');
  let publicId = '';
  let events: LoginEvent[] = [];
  let historyAvailable = true;
  try {
    const user = await db.query('SELECT public_id FROM users WHERE id = $1 LIMIT 1', [session.user.id]);
    publicId = user.rows[0]?.public_id ?? '';
    const history = await db.query(
      'SELECT occurred_at, host(ip_address) AS ip_address, country_code, region, city, user_agent, login_method FROM user_login_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 25',
      [session.user.id],
    );
    events = history.rows as LoginEvent[];
  } catch (error) {
    historyAvailable = false;
    console.error('Account security page could not load login history', error);
  }
  return <main className="dn-account-page">
    <div className="dn-account-breadcrumb"><Link href="/account">My account</Link><span>›</span><span>Security</span></div>
    <section className="dn-account-welcome"><div><span className="dn-account-eyebrow">ACCOUNT PROTECTION</span><h1>Security & sign-in activity</h1><p>Your permanent DigiNanba account ID and recent successful sign-ins.</p></div><div className="dn-account-avatar" aria-hidden="true">🔐</div></section>
    <section style={{background:'var(--surface, #fff)',border:'1px solid var(--border, #e5e7eb)',borderRadius:16,padding:24,marginBottom:24}}>
      <h2 style={{marginTop:0}}>Permanent account ID</h2>
      {publicId ? <p style={{fontSize:24,fontWeight:700,letterSpacing:1}}>{publicId}</p> : <p>Your account ID will appear here after the account identity migration is installed.</p>}
      <p style={{color:'var(--muted, #64748b)'}}>This ID identifies your account and is separate from your email address and password. It is not intended to be changed by account holders.</p>
    </section>
    <section style={{background:'var(--surface, #fff)',border:'1px solid var(--border, #e5e7eb)',borderRadius:16,padding:24}}>
      <h2 style={{marginTop:0}}>Recent sign-ins</h2>
      <p style={{color:'var(--muted, #64748b)'}}>Location is approximate and may be affected by VPNs, mobile networks, or browser privacy settings.</p>
      {!historyAvailable ? <p>Sign-in history is not available on this preview until the account security database migration is applied.</p> : events.length === 0 ? <p>No sign-in events are available yet.</p> : <div style={{display:'grid',gap:12}}>{events.map((event,i)=><article key={event.occurred_at+'-'+i} style={{borderTop:'1px solid var(--border, #e5e7eb)',paddingTop:14}}><strong>{new Date(event.occurred_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} UTC</strong><p style={{margin:'6px 0'}}>{[event.city,event.region,event.country_code].filter(Boolean).join(', ') || 'Location unavailable'} · {event.ip_address || 'IP unavailable'}</p><small>{event.login_method || 'Sign-in'}{event.user_agent ? ' · '+event.user_agent.slice(0,180) : ''}</small></article>)}</div>}
    </section>
    <p style={{marginTop:20}}><Link href="/account/settings">← Back to settings</Link></p>
  </main>;
}
