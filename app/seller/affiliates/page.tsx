import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SellerAffiliates() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="wrap">
      <Link href="/seller" className="muted">← Seller Center</Link>
      <h1>Affiliate program</h1>
      <p className="muted">Learn about partner referrals for digital products.</p>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Affiliate partnerships</h2>
        <p className="muted">Partner links and commission management will appear here when the affiliate program is available. No offer has been created.</p>
      </section>
    </main>
  );
}
