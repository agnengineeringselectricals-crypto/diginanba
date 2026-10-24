import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Seller() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Fseller');

  const tools = [
    {
      icon: '🛠️',
      title: 'Creator Studio',
      description: 'Describe product ideas, prepare drafts and review your work.',
      href: '/seller/studio',
      action: 'Open Creator Studio',
    },
    {
      icon: '📦',
      title: 'My products',
      description: 'Review and manage the products associated with your account.',
      href: '/seller/products',
      action: 'Manage products',
    },
    {
      icon: '📊',
      title: 'Analytics',
      description: 'View product performance when sales and engagement data are available.',
      href: '/seller/analytics',
      action: 'View analytics',
    },
  ];

  return (
    <main className="wrap">
      <div className="page-head">
        <div>
          <span className="eyebrow">CREATOR WORKSPACE</span>
          <h1>Creator Workspace</h1>
          <p className="muted">
            Create and manage digital product drafts from one place. Performance information appears when activity is available.
          </p>
        </div>
        <Link className="btn" href="/account">My account</Link>
      </div>
      <div className="account-grid">
        {tools.map((item) => (
          <Link className="panel" href={item.href} key={item.href}>
            <h2>{item.icon} {item.title}</h2>
            <p className="muted">{item.description}</p>
            <strong>{item.action} →</strong>
          </Link>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 20 }}>
        Sales, payouts and promotional tools will appear here when those services are available for your account.
      </p>
    </main>
  );
}
