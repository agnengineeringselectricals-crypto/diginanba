import MyShopsDiscovery from '@/components/MyShopsDiscovery';

export const metadata = { title: 'My Shops | DigiNanba' };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; city?: string }> }) {
  const params = await searchParams;
  const initialQuery = typeof params.q === 'string' ? params.q.slice(0, 100) : '';
  const initialCity = typeof params.city === 'string' ? params.city.slice(0, 120) : '';
  return <MyShopsDiscovery initialQuery={initialQuery} initialCity={initialCity} />;
}
