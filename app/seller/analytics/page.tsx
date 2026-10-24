import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SellerAnalytics() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="wrap">
      <Link href="/seller" className="muted">← Seller Center</Link>
      <h1>Sales Analytics</h1>
      <p className="muted">Understand how your products perform as sales and customer activity become available.</p>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Your performance overview</h2>
        <p className="muted">Your sales, revenue and product insights will appear here when verified activity is available. In the meantime, you can manage your product drafts and prepare your catalog.</p>
        <div className="button-row" style={{ marginTop: 16 }}>
          <Link className="btn primary" href="/seller/products">Manage products</Link>
          <Link className="btn" href="/seller/studio">Open Creator Studio</Link>
        </div>
      </section>
    </main>
  );
}
