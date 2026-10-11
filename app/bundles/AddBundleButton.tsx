'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Product = { slug: string; title: string; price: string; amountMinor: number; market: 'US' | 'UK' };

export default function AddBundleButton({ products }: { products: Product[] }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  function addBundle() {
    try {
      const stored = JSON.parse(localStorage.getItem('diginanba-cart') || '[]');
      const current: Product[] = Array.isArray(stored) ? stored : [];
      const next = [...current];
      for (const product of products) {
        const existing = next.findIndex((item) => item.slug === product.slug && item.market === product.market);
        if (existing >= 0) next[existing] = product;
        else next.push(product);
      }
      localStorage.setItem('diginanba-cart', JSON.stringify(next));
      setAdded(true);
      router.push('/cart');
    } catch {
      setAdded(false);
    }
  }

  return <button className="btn primary" onClick={addBundle}>{added ? 'Added to cart' : 'Add collection to cart'}</button>;
}
