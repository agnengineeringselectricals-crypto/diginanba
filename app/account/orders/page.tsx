'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Order = { id: string; date: string; items: number; total: string; status: string };

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/account/orders');
        if (response.ok) {
          const data = await response.json();
          if (active) setOrders(Array.isArray(data.orders) ? data.orders : []);
          return;
        }
        if (response.status === 503) setMessage('Your saved order history could not be reached. Please try again later.');
      } catch {
        if (active) setMessage('Your saved order history could not be reached. Please try again later.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="wrap">
      <Link href="/account" className="muted">← Account</Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">PURCHASE HISTORY</div>
          <h1>Orders &amp; purchases</h1>
          <p className="muted">Your orders and current payment status from DigiNanba.</p>
        </div>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
      {loading ? (
        <div className="panel"><p className="muted">Loading your orders…</p></div>
      ) : orders.length ? (
        <div className="panel">
          {orders.map((order) => (
            <div className="order-row" key={order.id}>
              <div>
                <b>Order {order.id.slice(0, 8).toUpperCase()}</b>
                <span>{order.date} · {order.items} item{order.items === 1 ? '' : 's'}</span>
              </div>
              <div>
                <b>{order.total}</b>
                <span className="badge">{order.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <h2>No orders yet</h2>
          <p className="muted">Your order history will appear here after you place an order.</p>
          <Link href="/explore" className="btn primary">Shop the marketplace</Link>
        </div>
      )}
    </main>
  );
}
