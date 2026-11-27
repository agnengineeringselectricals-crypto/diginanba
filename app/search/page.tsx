import SearchResultsClient from './SearchResultsClient';
import type { Market } from '@/lib/market';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; market?: string }> }) {
  const params = await searchParams;
  const market: Market = params.market === 'UK' || params.market === 'IN' || params.market === 'US' ? params.market : 'IN';
  const query = typeof params.q === 'string' ? params.q.slice(0, 180) : '';
  return <SearchResultsClient initialQuery={query} market={market} />;
}
