'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Item = { slug: string; title: string; price: string; category: string };

export default function Wishlist() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      let localItems: Item[] = [];
      try {
        const stored = JSON.parse(localStorage.getItem('diginanba-wishlist') || '[]');
        localItems = Array.isArray(stored) ? stored : [];
      } catch {
        localItems = [];
      }

      try {
        const response = await fetch('/api/wishlist');
        if (response.ok) {
          const data = await response.json();
          const remoteItems = Array.isArray(data.items) ? data.items : [];
          if (active) {
            setItems(remoteItems);
            localStorage.setItem('diginanba-wishlist', JSON.stringify(remoteItems));
          }
          return;
        }
      } catch {
        // Keep the local wishlist available when signed out or offline.
      }
      if (active) setItems(localItems);
    }
    load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function remove(slug: string) {
    const next = items.filter((item) => item.slug !== slug);
    setItems(next);
    localStorage.setItem('diginanba-wishlist', JSON.stringify(next));
    try {
      await fetch('/api/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
    } catch {
      setMessage('Removed on this device. Account sync will retry when available.');
    }
  }

  return (
    <main className="wrap">
      <Link href="/account" className="muted">← Account</Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">SAVED PRODUCTS</div>
          <h1>Wishlist</h1>
          <p className="muted">Keep products you want to compare or buy later.</p>
        </div>
        <Link href="/explore" className="btn">Explore products</Link>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
      {loading ? (
        <div className="panel"><p className="muted">Loading your wishlist…</p></div>
      ) : items.length === 0 ? (
        <div className="panel">
          <h2>Your wishlist is empty</h2>
          <p className="muted">Tap “Save to wishlist” on a product to keep it here.</p>
          <Link href="/explore" className="btn primary">Find products</Link>
        </div>
      ) : (
        <div className="product-list-grid">
          {items.map((item) => (
            <article className="panel" key={item.slug}>
              <span className="category">{item.category}</span>
              <h2>{item.title}</h2>
              <strong>{item.price}</strong>
              <div className="button-row">
                <Link className="btn primary" href={'/products/' + item.slug}>View product</Link>
                <button className="btn" onClick={() => remove(item.slug)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
