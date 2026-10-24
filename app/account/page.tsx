import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import './account.css';

const destinations = [
  { icon: '📚', title: 'My DigiNanba Library', description: 'Access purchased resources and future updates.', href: '/account/library', action: 'Open library' },
  { icon: '🧾', title: 'Orders & purchases', description: 'Review your order history and payment status.', href: '/account/orders', action: 'View orders' },
  { icon: '❤️', title: 'Wishlist', description: 'Keep useful products saved for later.', href: '/account/wishlist', action: 'View wishlist' },
  { icon: '⚙️', title: 'Settings & preferences', description: 'Manage your region, language and display preferences.', href: '/account/settings', action: 'Manage settings' },
  { icon: '🛍️', title: 'Creator Studio', description: 'Apply to create products and manage your product drafts.', href: '/seller/studio', action: 'Open studio' },
];
export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const firstName = (session.user.name || session.user.email || 'Customer').split(' ')[0];
  const initial = (session.user.name || session.user.email || 'D').slice(0,1).toUpperCase();
  return <main className="dn-account-page">
    <div className="dn-account-breadcrumb"><Link href="/">Home</Link><span>›</span><span>My account</span></div>
    <section className="dn-account-welcome"><div><span className="dn-account-eyebrow">YOUR DIGINANBA</span><h1>Welcome back, {firstName}.</h1><p>Your digital products, purchases and preferences—together in one place.</p><span className="dn-account-email">{session.user.email}</span></div><div className="dn-account-avatar" aria-hidden="true">{initial}</div></section>
    <div className="dn-account-shortcuts"><Link href="/explore"><span>🔎</span><b>Discover products</b><span>→</span></Link><Link href="/account/library"><span>📚</span><b>My library</b><span>→</span></Link><Link href="/account/settings"><span>⚙️</span><b>Preferences</b><span>→</span></Link></div>
    <div className="dn-account-section-title"><div><h2>Your account</h2><p>Choose what you would like to do next.</p></div></div>
    <div className="dn-account-grid">{destinations.map((item) => <Link className="dn-account-card" href={item.href} key={item.href}><span className="dn-account-card-icon">{item.icon}</span><h3>{item.title}</h3><p>{item.description}</p><span className="dn-account-card-action">{item.action} <span>→</span></span></Link>)}</div>
    <p className="dn-account-footnote">Your order history and library show the information currently available to your account. Download access appears when a purchase includes an available digital file.</p>
  </main>;
}
