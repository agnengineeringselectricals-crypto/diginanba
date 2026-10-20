import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SellerProducts() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <main className="wrap">
    <Link href="/seller" className="muted">← Seller Center</Link>
    <div className="page-head"><div><div className="eyebrow">SELLER CENTER</div><h1>Products</h1><p className="muted">Build and manage digital products inside DigiNanba.</p></div><Link className="btn primary" href="/seller/studio">+ Create product</Link></div>
    <div className="product-list-grid">
      <section className="panel"><h2>Creator Studio</h2><p className="muted">Create a structured interactive-tool or worksheet draft, choose its market and price, and save a versioned product build.</p><Link className="btn primary" href="/seller/studio">Open Creator Studio →</Link></section>
      <section className="panel"><h2>Publishing checklist</h2><p className="muted">Product validation, safe preview, moderation approval, localized editions, secure delivery, verified checkout and creator earnings settlement.</p><p className="muted">Publishing and real payouts remain gated until their validation and payment-provider integrations are complete.</p></section>
    </div>
  </main>;
}
