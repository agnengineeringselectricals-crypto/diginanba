import { getProducts } from '@/lib/catalog';
import { getHomepageDiscovery } from '@/lib/discovery';
import HomePageClient from './HomePageClient';

export default async function HomePage() {
  const [products, discovery] = await Promise.all([
    getProducts('US'),
    getHomepageDiscovery(),
  ]);
  return <HomePageClient initialProducts={products} {...discovery} />;
}
