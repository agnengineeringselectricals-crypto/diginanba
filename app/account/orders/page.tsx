'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Order = { id: string; date: string; items: number; total: string; status: string; canRequestRefund?: boolean };

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [retry, setRetry] = useState(0);
  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundMessage, setRefundMessage] = useState('');

  async function submitRefund(orderId: string) {
    setRefundMessage('');
    if (refundReason.trim().length < 5) { setRefundMessage('Please describe the reason in at least 5 characters.'); return; }
    setRefundBusy(true);
    try {
      const response = await fetch('/api/account/refunds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId, reason: refundReason.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit your request.');
      setRefundMessage('Request submitted for review. This is not a refund approval or payment confirmation.');
      setRefundOrderId('');
      setRefundReason('');
    } catch (error) {
      setRefundMessage(error instanceof Error ? error.message : 'Could not submit your request.');
    } finally { setRefundBusy(false); }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setMessage('');
      setNeedsLogin(false);
      try {
        const response = await fetch('/api/account/orders', { cache: 'no-store' });
        if (response.status === 401) {
          if (active) setNeedsLogin(true);
          return;
        }
        if (!response.ok) {
          if (active) setMessage(response.status === 503
            ? 'Your saved order history is temporarily unavailable. Please try again.'
            : 'We could not load your order history. Please try again.');
          return;
        }
        const data = await response.json();
        if (active) setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch {
        if (active) setMessage('We could not connect to your order history. Check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  return (
    <main className="wrap dn-orders-page">
      <Link href="/account" className="muted">← Account</Link>
      <div className="page-head"><div><div className="eyebrow">PURCHASE HISTORY</div><h1>Orders &amp; purchases</h1><p className="muted">Review orders recorded for your DigiNanba account.</p></div></div>
      {loading ? <div className="panel"><p className="muted">Loading your orders…</p></div>
      : needsLogin ? <div className="panel"><h2>Sign in to see your orders</h2><p className="muted">Your purchase history is private and available only to your account.</p><Link href="/login?callbackUrl=%2Faccount%2Forders" className="btn primary">Sign in securely</Link></div>
      : message ? <div className="panel"><h2>Orders are temporarily unavailable</h2><p className="muted" role="status">{message}</p><button className="btn primary" onClick={() => setRetry((n) => n + 1)}>Try again</button></div>
      : orders.length ? <>{refundMessage && <div className="panel" role="status">{refundMessage}</div>}<div className="panel">{orders.map((order) => <div className="order-row" key={order.id}><div><b>Order {order.id.slice(0, 8).toUpperCase()}</b><span>{order.date} · {order.items} item{order.items === 1 ? '' : 's'}</span>{order.canRequestRefund && <button className="btn" type="button" onClick={() => { setRefundOrderId(refundOrderId === order.id ? '' : order.id); setRefundMessage(''); }}>Request refund / cancellation</button>}{refundOrderId === order.id && <div className="refund-form"><label htmlFor="refund-reason">Reason for your request</label><textarea id="refund-reason" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} rows={3} maxLength={2000} placeholder="Explain what happened and what you need."/><button className="btn primary" type="button" disabled={refundBusy} onClick={() => void submitRefund(order.id)}>{refundBusy ? 'Submitting…' : 'Submit request'}</button></div>}</div><div><b>{order.total}</b><span className="badge">{order.status}</span></div></div>)}</div></>
      : <div className="panel"><h2>No orders yet</h2><p className="muted">Orders will appear here after you place them. DigiNanba checkout is currently in demo mode, so an order is not proof of payment and does not unlock downloads.</p><Link href="/explore" className="btn primary">Explore the marketplace</Link></div>}
      <style>{`.dn-orders-page{padding-bottom:48px}.dn-orders-page .page-head{margin-top:18px}.dn-orders-page .panel{padding:22px}.dn-orders-page .order-row{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:16px 0;border-bottom:1px solid var(--border,#e6e8f0)}.dn-orders-page .order-row:last-child{border-bottom:0}.dn-orders-page .order-row>div{display:grid;gap:7px;min-width:0}.dn-orders-page .refund-form{display:grid;gap:8px;max-width:440px;margin-top:8px}.dn-orders-page .refund-form label{font-size:12px;font-weight:700}.dn-orders-page .refund-form textarea{width:100%;border:1px solid var(--border,#d8dce7);border-radius:10px;padding:10px;font:inherit}.dn-orders-page .order-row>div:last-child{text-align:right}.dn-orders-page .order-row span{font-size:12px;color:var(--muted,#777f91)}@media(max-width:480px){.dn-orders-page .order-row{align-items:flex-start}.dn-orders-page .order-row b{overflow-wrap:anywhere}}`}</style>
    </main>
  );
}
