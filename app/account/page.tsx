import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import AccountSignOut from './AccountSignOut';

export const metadata={title:'My Account | DigiNanba',description:'Manage your DigiNanba account, purchases, downloads, security and preferences.'};

const cards=[
 ['/account/profile','👤','Profile','Name and account information'],
 ['/account/security','🔐','Login & Security','Password and linked sign-in methods'],
 ['/account/orders','📦','Your Orders','Purchase history and order status'],
 ['/account/downloads','⬇️','Digital Library','Your purchased digital products'],
 ['/account/preferences','🌍','Preferences','Country, currency, language and notifications'],
];

export default async function AccountPage(){
 const session=await auth(); if(!session?.user?.id)return null;
 const [user,orders,downloads,linked]=await Promise.all([
  db.query('SELECT id,email,display_name,password_hash,created_at FROM users WHERE id=$1',[session.user.id]),
  db.query('SELECT COUNT(*)::int count FROM orders WHERE user_id=$1',[session.user.id]),
  db.query('SELECT COUNT(*)::int count FROM downloads d JOIN order_items oi ON oi.id=d.order_item_id JOIN orders o ON o.id=oi.order_id WHERE o.user_id=$1',[session.user.id]),
  db.query('SELECT provider FROM user_auth_accounts WHERE user_id=$1 ORDER BY provider',[session.user.id]),
 ]);
 const u=user.rows[0]; if(!u)return null;
 const signInMethods=linked.rows.length+(u.password_hash?1:0);
 return <main className="account-page"><div className="account-container">
  <div className="account-breadcrumb"><Link href="/">DigiNanba</Link><span>›</span><strong>My Account</strong></div>
  <section className="account-welcome"><div><span className="account-eyebrow">MY ACCOUNT</span><h1>Hello, {u.display_name||'Customer'}</h1><p>{u.email}</p></div><AccountSignOut/></section>
  <div className="account-summary"><div><strong>{orders.rows[0].count}</strong><span>Orders</span></div><div><strong>{downloads.rows[0].count}</strong><span>Digital downloads</span></div><div><strong>{signInMethods}</strong><span>Sign-in methods</span></div></div>
  <section className="account-card-grid">{cards.map(([href,icon,title,desc])=><Link href={href} className="account-card" key={href}><span className="account-card-icon">{icon}</span><span><strong>{title}</strong><small>{desc}</small></span><span className="account-arrow">›</span></Link>)}</section>
  <section className="account-quick"><div><h2>Need help?</h2><p>Get help with your account, cart, checkout or digital products.</p></div><div className="account-quick-actions"><Link className="account-secondary" href="/help">Help &amp; Support</Link><Link className="account-secondary" href="/explore">Continue shopping</Link></div></section>
 </div></main>;
}
