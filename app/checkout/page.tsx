'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Market = 'US' | 'UK' | 'IN';
type Item = { slug: string; title: string; price: string; amountMinor: number; market: Market; quantity?: number };
type VerifyResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutResult = { orderId: string; paymentMode: 'demo' | 'razorpay'; error?: string; razorpay?: { keyId: string; orderId: string; amount: number; currency: string; name: string; description: string } };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, callback: (error: unknown) => void) => void } } }

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

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

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
    if (market !== 'IN') { setError('Secure online payments are currently available for India (INR) only. Your cart has not been charged.'); return; }
    if (status !== 'authenticated') { router.push('/login?callbackUrl=/checkout'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ market, items: items.map((item) => ({ slug: item.slug, quantity: item.quantity || 1 })) }),
      });
      const data = await response.json() as CheckoutResult;
      if (!response.ok) throw new Error(data.error || 'Checkout failed');
      if (data.paymentMode === 'demo') {
        localStorage.removeItem('diginanba-cart');
        router.push('/order-success?orderId=' + encodeURIComponent(data.orderId));
        return;
      }
      if (!data.razorpay) throw new Error('The payment provider response was incomplete.');
      if (!(await loadRazorpay()) || !window.Razorpay) throw new Error('Secure checkout could not load. Please try again.');
      const checkout = new window.Razorpay({
        key: data.razorpay.keyId,
        amount: data.razorpay.amount,
        currency: data.razorpay.currency,
        name: data.razorpay.name,
        description: data.razorpay.description,
        order_id: data.razorpay.orderId,
        handler: async (result: VerifyResult) => {
          try {
            const verify = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderId, ...result }),
            });
            const verified = await verify.json() as { verified?: boolean; error?: string };
            if (!verify.ok || verified.verified !== true) throw new Error(verified.error || 'Payment could not be verified. Contact support before retrying.');
            localStorage.removeItem('diginanba-cart');
            router.push('/order-success?orderId=' + encodeURIComponent(data.orderId));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Payment verification failed. Please contact support.');
          } finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false), escape: true, confirm_close: true },
      });
      checkout.on('payment.failed', (failure: unknown) => {
        const description = failure && typeof failure === 'object' && 'error' in failure
          ? (failure as { error?: { description?: string } }).error?.description : undefined;
        setError(description || 'Payment was not completed.');
        setBusy(false);
      });
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
      setBusy(false);
    }
  }

  return <main className="wrap checkout-page dn-checkout-page">
    <div className="sectionhead"><div><div className="eyebrow">SECURE CHECKOUT</div><h1>Review your order</h1><p className="muted">Check your items and total before placing your order.</p></div><Link className="btn" href="/cart">← Edit cart</Link></div>
    {!items.length ? <div className="panel dn-checkout-empty"><h2>Your cart is empty</h2><p className="muted">Find a digital product to get started.</p><Link className="btn primary" href="/explore">Explore products</Link></div> : <div className="checkout-grid dn-checkout-grid">
      <section className="panel dn-checkout-order"><h2>Order summary</h2><p className="muted dn-checkout-market">{marketName(market)}</p>{items.map((item) => <div className="cart-row dn-checkout-line" key={item.market + item.slug}><div><b>{item.title}</b><span className="muted">Qty {item.quantity || 1} × {item.price}</span></div><strong>{new Intl.NumberFormat(locale(item.market), {style:'currency',currency:currency(item.market)}).format(item.amountMinor * (item.quantity || 1) / 100)}</strong></div>)}<div className="total-row"><span>Subtotal</span><strong>{fmt.format(totals / 100)}</strong></div><p className="muted dn-checkout-server-note">The server rechecks current published prices when creating the order.</p></section>
      <section className="panel dn-checkout-payment"><div className="dn-checkout-payment-icon">🔒</div><h2>Payment & order</h2><p className="muted">Payment options depend on the configured storefront and provider settings. DigiNanba never asks you to enter card details directly on this page.</p>{mixedMarket && <div className="dn-checkout-error" role="alert">Your cart contains multiple currencies. <Link href="/cart">Return to your cart</Link> and remove items from other markets.</div>}{error && <p className="error" role="alert">{error}</p>}<button className="btn primary wide" disabled={busy || mixedMarket} onClick={pay}>{busy ? 'Preparing secure checkout…' : status === 'authenticated' ? 'Continue to payment' : 'Sign in to continue'}</button><p className="small muted">A paid order is confirmed only after server-side payment verification.</p></section>
    </div>}
  </main>;
}
