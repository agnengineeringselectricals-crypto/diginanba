import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import './account.css';
import AccountSignOut from './AccountSignOut';
import MaskedSensitiveValue from '@/components/MaskedSensitiveValue';

const destinations = [
  { icon: '🔐', title: 'My Files', description: 'Secure personal cloud storage with trusted-device access controls.', href: '/account/files', action: 'Open secure files' },
  { icon: '📚', title: 'My DigiNanba Library', description: 'Access purchased resources and future updates.', href: '/account/library', action: 'Open library' },
  { icon: '💬', title: 'Shop messages', description: 'Chat with connected shops, share handwritten lists and send custom order requests.', href: '/account/messages', action: 'Open shop messages' },
  { icon: '🧾', title: 'Orders & purchases', description: 'Review your order history and payment status.', href: '/account/orders', action: 'View orders' },
  { icon: '❤️', title: 'Wishlist', description: 'Keep useful products saved for later.', href: '/account/wishlist', action: 'View wishlist' },
  { icon: '⚙️', title: 'Settings & preferences', description: 'Manage your region, language and display preferences.', href: '/account/settings', action: 'Manage settings' },
  { icon: '🏪', title: 'My Shop Dashboard', description: 'Manage your shop, contact details and product listings.', href: '/account/my-shops', action: 'Manage my shops' },
  { icon: '🤝', title: 'Invite a Shop Owner', description: 'Invite a local shop to join DigiNanba and connect with you.', href: '/account/invite-shop', action: 'Invite a shop owner' },
  { icon: '🛍️', title: 'Creator Studio', description: 'Apply to create products and manage your product drafts.', href: '/seller/studio', action: 'Open studio' },
];
export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  let publicId = '';
  let connectedShops: { id: string; business_name: string; public_id: string | null; city: string | null; region: string | null; is_pinned: boolean }[] = [];
  try { const result = await db.query('SELECT public_id FROM users WHERE id = $1 LIMIT 1', [session.user.id]); publicId = result.rows[0]?.public_id ?? ''; } catch (error) { console.error('Unable to load account public ID', error); }
  try { const result = await db.query('SELECT b.id,b.business_name,b.public_id,b.city,b.region,c.is_pinned FROM marketplace_customer_workspace_connections c JOIN marketplace_customer_accounts a ON a.id=c.workspace_account_id JOIN marketplace_businesses b ON b.id=a.workspace_ref WHERE c.customer_user_id=$1 AND c.status=\'connected\' AND a.status=\'active\' ORDER BY c.is_pinned DESC,c.connected_at DESC LIMIT 20', [session.user.id]); connectedShops = result.rows; } catch (error) { console.error('Unable to load connected shops', error); }
  const firstName = (session.user.name || session.user.email || 'Customer').split(' ')[0];
  const initial = (session.user.name || session.user.email || 'D').slice(0,1).toUpperCase();
  return <main className="dn-account-page">
    <div className="dn-account-breadcrumb"><Link href="/">Home</Link><span>›</span><span>My account</span></div>
    <section className="dn-account-welcome"><div><span className="dn-account-eyebrow">YOUR DIGINANBA</span><h1>Welcome back, {firstName}.</h1><p>Your digital products, purchases and preferences—together in one place.</p><span className="dn-account-email"><MaskedSensitiveValue value={session.user.email || ''} kind="email" label="Email address" /></span>{publicId && <p style={{marginTop:10,fontWeight:700}}>DigiNanba ID: <MaskedSensitiveValue value={publicId} kind="id" label="Permanent DigiNanba ID" /></p>}</div><div className="dn-account-welcome-actions"><AccountSignOut /><div className="dn-account-avatar" aria-hidden="true">{initial}</div></div></section>
    {connectedShops.length > 0 && <section style={{margin:"22px 0",padding:18,border:"1px solid #e4e7ec",borderRadius:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2 style={{margin:"0 0 4px",fontSize:20}}>Your connected shops</h2><p style={{margin:0,color:"#667085",fontSize:13}}>Shops that invited you or accepted your invitation.</p></div><Link href="/account/invite-shop">Invite a shop →</Link></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginTop:14}}>{connectedShops.map(shop=><div key={shop.id} style={{padding:13,border:"1px solid #eaecf0",borderRadius:12}}><strong>{shop.business_name}</strong><div style={{fontSize:12,color:"#667085",marginTop:4}}>{[shop.city,shop.region].filter(Boolean).join(", ")}{shop.public_id?" · "+shop.public_id:""}</div>{shop.is_pinned?<span style={{fontSize:11,color:"#176b4d"}}>Pinned shop</span>:null}</div>)}</div></section>}
    <div className="dn-account-shortcuts"><Link href="/explore"><span>🔎</span><b>Discover products</b><span>→</span></Link><Link href="/account/library"><span>📚</span><b>My library</b><span>→</span></Link><Link href="/account/settings"><span>⚙️</span><b>Preferences</b><span>→</span></Link></div>
    <div className="dn-account-section-title"><div><h2>Your account</h2><p>Choose what you would like to do next.</p></div></div>
    <div className="dn-account-grid">{destinations.map((item) => <Link className="dn-account-card" href={item.href} key={item.href}><span className="dn-account-card-icon">{item.icon}</span><h3>{item.title}</h3><p>{item.description}</p><span className="dn-account-card-action">{item.action} <span>→</span></span></Link>)}</div>
    <p className="dn-account-footnote">Your order history and library show the information currently available to your account. Download access appears when a purchase includes an available digital file.</p>
  </main>;
}
