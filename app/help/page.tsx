import Link from 'next/link';

export const metadata = {
  title: 'Help and Support | DigiNanba',
  description: 'Help with your DigiNanba account, cart and checkout.',
};

export default function HelpPage() {
  return <main className="wrap help-page">
    <Link href="/" className="muted">← Back to DigiNanba</Link>
    <div className="panel help-panel">
      <span className="eyebrow">CUSTOMER HELP</span>
      <h1>How can we help?</h1>
      <p className="muted">Find your way around DigiNanba or continue to the right part of your account.</p>
      <div className="help-topics">
        <section><h2>Account and purchases</h2><p>Sign in to view your account and purchase information.</p><Link className="btn" href="/account">Go to your account</Link></section>
        <section><h2>Cart and checkout</h2><p>Review items in your cart before continuing to checkout. Checkout requires an account.</p><Link className="btn" href="/cart">View your cart</Link></section>
        <section id="creators"><h2>Creators and sellers</h2><p>Create a DigiNanba account to get started.</p><Link className="btn" href="/signup">Create an account</Link></section>
        <section><h2>Payments</h2><p>The current checkout is in demo mode. No real payment is collected.</p><Link className="btn" href="/explore">Explore products</Link></section>
      </div>
    </div>
  </main>;
}
