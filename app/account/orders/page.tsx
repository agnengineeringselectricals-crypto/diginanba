'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Order = {
  id: string;
  date: string;
  items: number;
  total: string;
  status: string;
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    try {
      setOrders(JSON.parse(localStorage.getItem('diginanba-orders') || '[]'));
    } catch {
      setOrders([]);
    }
  }, []);

  return (
    <main className="wrap">
      <Link href="/account" className="muted">← Account</Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">PURCHASE HISTORY</div>
          <h1>Orders &amp; purchases</h1>
          <p className="muted">Receipts and completed digital purchases appear here.</p>
        </div>
      </div>

      {orders.length ? (
        <div className="panel">
          {orders.map((o) => (
            <div className="order-row" key={o.id}>
              <div>
                <b>{o.id}</b>
                <span>{o.date} · {o.items} item{o.items === 1 ? '' : 's'}</span>
              </div>
              <div>
                <b>{o.total}</b>
                <span className="badge">{o.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <h2>No completed purchases yet</h2>
          <p className="muted">Your order history will be saved after checkout.</p>
          <Link href="/explore" className="btn primary">Shop the marketplace</Link>
        </div>
      )}
    </main>
  );
}
