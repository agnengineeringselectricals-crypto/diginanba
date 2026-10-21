'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Market = 'US' | 'UK' | 'IN';
type Item = { slug: string; title: string; price: string; amountMinor: number; market: Market; quantity?: number };
function normalize(items: Item[]) {
  const grouped = new Map<string, Item>();
  for (const item of items) {
    if (!item?.slug || !['US','UK','IN'].includes(item.market)) continue;
    const key = item.market + ':' + item.slug;
    const previous = grouped.get(key);
    grouped.set(key, { ...item, quantity: Math.min(10, Math.max(1, (previous?.quantity || 0) + (item.quantity || 1))) });
  }
  return [...grouped.values()];
}
const currency = (market: Market) => market === 'US' ? 'USD' : market === 'UK' ? 'GBP' : 'INR';
const locale = (market: Market) => market === 'US' ? 'en-US' : market === 'UK' ? 'en-GB' : 'en-IN';
const marketName = (market: Market) => market === 'US' ? 'United States · USD' : market === 'UK' ? 'United Kingdom · GBP' : 'India · INR';

export default function Checkout() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('diginanba-cart') || '[]');
      const normalized = normalize(Array.isArray(raw) ? raw : []);
      setItems(normalized);
      localStorage.setItem('diginanba-cart', JSON.stringify(normalized));
    } catch { setItems([]); }
  }, []);
  const markets = [...new Set(items.map((item) => item.market))];
  const mixedMarket = markets.length > 1;
  const market = items[0]?.market || 'US';
  const totals = useMemo(() => items.reduce((sum, item) => sum + item.amountMinor * (item.quantity || 1), 0), [items]);
  const fmt = new Intl.NumberFormat(locale(market), { style: 'currency', currency: currency(market) });

  async function pay() {
    setError('');
    if (!items.length) { setError('Your cart is empty. Add a product before checkout.'); return; }
    if (mixedMarket) { setError('Your cart has more than one storefront currency. Return to your cart and remove items from other markets.'); return; }
    if (status !== 'authenticated') { router.push('/login?callbackUrl=/checkout'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ market, items: items.map((item) => ({ slug: item.slug, quantity: item.quantity || 1 })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout failed');

      if (data.paymentMode !== 'razorpay') {
        throw new Error(data.message || 'Online payments are not enabled yet. No payment was collected.');
      }

      const w = window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } };
      if (!w.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Could not load Razorpay checkout')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.dataset.razorpayCheckout = 'true';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Could not load Razorpay checkout'));
          document.body.appendChild(script);
        });
      }
      if (!w.Razorpay) throw new Error('Razorpay checkout did not load');

      const checkout = new w.Razorpay({
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency,
        name: 'DigiNanba',
        description: 'Digital product order',
        handler: async (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verify = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderId, ...result }),
            });
            const verified = await verify.json();
            if (!verify.ok || !verified.verified) throw new Error(verified.error || 'Payment verification failed');
            localStorage.removeItem('diginanba-cart');
            router.push(`/order-success?orderId=${encodeURIComponent(data.orderId)}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Payment was received but confirmation failed. Please contact support before retrying.');
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: '#4f46e5' },
      });
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
      setBusy(false);
    }
  }

  return <main className="wrap checkout-page dn-checkout-page">
    <div className="sectionhead"><div><div className="eyebrow">SECURE CHECKOUT</div><h1>Review your order</h1><p className="muted">Check your items and total before payment.</p></div><Link className="btn" href="/cart">← Edit cart</Link></div>
    {!items.length ? <div className="panel dn-checkout-empty"><h2>Your cart is empty</h2><p className="muted">Find a digital product to get started.</p><Link className="btn primary" href="/explore">Explore products</Link></div> : <div className="checkout-grid dn-checkout-grid">
      <section className="panel dn-checkout-order"><h2>Order summary</h2><p className="muted dn-checkout-market">{marketName(market)}</p>{items.map((item) => <div className="cart-row dn-checkout-line" key={item.market + item.slug}><div><b>{item.title}</b><span className="muted">Qty {item.quantity || 1} × {item.price}</span></div><strong>{new Intl.NumberFormat(locale(item.market), {style:'currency',currency:currency(item.market)}).format(item.amountMinor * (item.quantity || 1) / 100)}</strong></div>)}<div className="total-row"><span>Subtotal</span><strong>{fmt.format(totals / 100)}</strong></div><p className="muted dn-checkout-server-note">The server rechecks published prices. Payment confirmation is verified with the payment provider.</p></section>
      <section className="panel dn-checkout-payment"><div className="dn-checkout-payment-icon">🔒</div><h2>Payment & order</h2><p className="muted">Secure online payment is available only when DigiNanba has explicitly enabled and tested Razorpay checkout.</p>{mixedMarket && <div className="dn-checkout-error" role="alert">Your cart contains multiple currencies. <Link href="/cart">Return to your cart</Link> and remove items from other markets.</div>}{error && <p className="error" role="alert">{error}</p>}<button className="btn primary wide" disabled={busy || mixedMarket} onClick={pay}>{busy ? 'Creating order…' : status === 'authenticated' ? 'Pay securely' : 'Sign in to continue'}</button><p className="small muted">Real payments remain disabled until payment-provider setup and verification are complete.</p></section>
    </div>}
    <style>{`.dn-checkout-page{padding-bottom:50px}.dn-checkout-page .sectionhead{align-items:center;gap:16px}.dn-checkout-page .sectionhead p{margin:7px 0 0}.dn-checkout-grid{align-items:start;gap:18px}.dn-checkout-order,.dn-checkout-payment{padding:22px}.dn-checkout-order h2,.dn-checkout-payment h2{margin-top:0}.dn-checkout-market{font-size:12px;margin-top:-8px}.dn-checkout-line{display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid var(--border,#e6e8f0)}.dn-checkout-line>div{display:grid;gap:5px;min-width:0}.dn-checkout-line b{font-size:13px}.dn-checkout-line .muted{font-size:11px}.dn-checkout-line strong{white-space:nowrap;font-size:13px}.dn-checkout-server-note{font-size:11px;line-height:1.55;margin-top:14px}.dn-checkout-payment-icon{width:44px;height:44px;border-radius:13px;background:#f0edff;display:grid;place-items:center;font-size:22px;margin-bottom:12px}.dn-checkout-payment>p{font-size:12px;line-height:1.6}.dn-checkout-error{background:#fff5f5;border:1px solid #f0b8b8;border-radius:10px;padding:12px;font-size:12px;margin:12px 0}.dn-checkout-error a{font-weight:800;text-decoration:underline}.dn-checkout-empty{padding:32px}@media(max-width:760px){.dn-checkout-page .sectionhead{align-items:flex-start;flex-direction:column}.dn-checkout-grid{grid-template-columns:1fr}}`}</style>
  </main>;
}
