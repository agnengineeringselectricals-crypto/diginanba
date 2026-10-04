import { getProducts } from '@/lib/catalog';
import HomePageClient from './HomePageClient';

export default async function HomePage() {
  const products = await getProducts('US');
  return <HomePageClient initialProducts={products} />;
}
