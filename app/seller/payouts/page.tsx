import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SellerPayouts() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="wrap">
      <Link href="/seller" className="muted">← Seller Center</Link>
      <h1>Payouts</h1>
      <p className="muted">View your creator earnings and payout information.</p>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Creator payouts</h2>
        <p className="muted">Payout options will appear here when creator payments are available. You do not need to enter banking details on this page right now.</p>
      </section>
    </main>
  );
}
