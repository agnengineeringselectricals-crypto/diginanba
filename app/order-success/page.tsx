import Link from 'next/link';

export default async function Success({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const params = await searchParams;
  return <main className="wrap"><div className="panel success">
    <div className="eyebrow">ORDER STATUS</div>
    <h1>Thank you for choosing DigiNanba.</h1>
    <p className="muted">Order reference: {params.orderId || 'Not provided'}. This page is not a payment receipt. Your order is considered paid only after DigiNanba verifies the payment with the provider. Check your account for the current status.</p>
    <div className="actions"><Link className="btn primary" href="/account/orders">View my orders</Link><Link className="btn" href="/account/library">My digital library</Link></div>
  </div></main>;
}
