'use client';

import { useRouter } from 'next/navigation';

type Product = {
  slug: string;
  title: string;
  price: string;
  amountMinor: number;
  market: 'US' | 'UK';
};

export default function AddToCartButton({ product }: { product: Product }) {
  const router = useRouter();

  function addToCart() {
    try {
      const current = JSON.parse(
        localStorage.getItem('diginanba-cart') || '[]'
      );

      const items = Array.isArray(current)
        ? current.filter((item: Product) => item.slug !== product.slug)
        : [];

      localStorage.setItem(
        'diginanba-cart',
        JSON.stringify([...items, product])
      );

      router.push('/cart');
    } catch {
      alert('Unable to add this product to the cart. Please try again.');
    }
  }

  return (
    <button className="btn primary" onClick={addToCart}>
      Add to cart
    </button>
  );
}
