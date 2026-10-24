import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SellerCoupons() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="wrap">
      <Link href="/seller" className="muted">← Seller Center</Link>
      <h1>Coupons & offers</h1>
      <p className="muted">Manage promotions for your digital products.</p>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Promotions</h2>
        <p className="muted">Coupon creation will appear here when promotional offers are available. No coupon has been created.</p>
      </section>
    </main>
  );
}
