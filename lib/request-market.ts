import { headers } from 'next/headers';
import type { Market } from './market';

export async function getRequestMarket(): Promise<Market> {
  const requestHeaders = await headers();
  const saved = requestHeaders.get('cookie')?.match(/(?:^|;\\s*)diginanba-market=(US|UK|IN)(?:;|$)/)?.[1];
  if (saved === 'US' || saved === 'UK' || saved === 'IN') return saved;
  const country = (requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry') || '').toUpperCase();
  return country === 'IN' ? 'IN' : country === 'GB' ? 'UK' : 'US';
}
