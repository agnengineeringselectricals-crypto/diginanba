import { headers } from 'next/headers';
import { getProducts } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import HomePageClient from './HomePageClient';

export default async function HomePage() {
  const requestHeaders = await headers();
  const visitorCountry = (requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry') || '').toUpperCase();
  const initialMarket: Market = visitorCountry === 'IN' ? 'IN' : visitorCountry === 'GB' ? 'UK' : 'US';
  const products = await getProducts(initialMarket);
  return <HomePageClient initialProducts={products} initialMarket={initialMarket} />;
}
