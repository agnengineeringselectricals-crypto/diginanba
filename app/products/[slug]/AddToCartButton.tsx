'use client';

import { useRouter } from 'next/navigation';

type Product = {
  slug: string;
  title: string;
  price: string;
  amountMinor: number;
  market: 'US' | 'UK' | 'IN';
};

export default function AddToCartButton({ product }: { product: Product }) {
  const router = useRouter();

  function addToCart() {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('diginanba-cart') || '[]');
      const items = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
      const index = items.findIndex((item) => item.slug === product.slug && item.market === product.market);
      if (index >= 0) {
        items[index] = { ...items[index], quantity: Math.min(10, Math.max(1, Number(items[index].quantity) || 1) + 1) };
      } else {
        items.push({ ...product, quantity: 1 });
      }
      localStorage.setItem('diginanba-cart', JSON.stringify(items));
      router.push('/cart');
    } catch {
      window.alert('Unable to add this product to the cart. Please try again.');
    }
  }

  return (
    <button className="btn primary" type="button" onClick={addToCart}>
      Add to cart
    </button>
  );
}
