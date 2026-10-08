'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Item = {
  slug: string;
  title: string;
  price: string;
  category: string;
};

export default function Wishlist() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem('diginanba-wishlist') || '[]'));
    } catch {
      setItems([]);
    }
  }, []);

  function remove(slug: string) {
    const next = items.filter((x) => x.slug !== slug);
    setItems(next);
    localStorage.setItem('diginanba-wishlist', JSON.stringify(next));
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

      {items.length ? (
        <div className="product-list-grid">
          {items.map((x) => (
            <article className="panel" key={x.slug}>
              <span className="category">{x.category}</span>
              <h2>{x.title}</h2>
              <strong>{x.price}</strong>
              <div className="button-row">
                <Link className="btn primary" href={'/products/' + x.slug}>View product</Link>
                <button className="btn" onClick={() => remove(x.slug)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <h2>Your wishlist is empty</h2>
          <p className="muted">Tap “Save to wishlist” on a product to keep it here.</p>
          <Link href="/explore" className="btn primary">Find products</Link>
        </div>
      )}
    </main>
  );
}
