import { getProducts } from '@/lib/catalog';
import CompareClient from './CompareClient';

export default async function ComparePage() {
  const products = await getProducts('US');
  return <CompareClient products={products.map((product) => ({
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    price: product.price,
    market: product.market,
  }))} />;
}
