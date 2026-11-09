import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

export async function GET() {
  const requestHeaders = await headers();
  const countryCode = (
    requestHeaders.get('x-vercel-ip-country') ||
    requestHeaders.get('cf-ipcountry') ||
    requestHeaders.get('x-country-code') ||
    ''
  ).trim().toUpperCase();

  return NextResponse.json(
    { countryCode: /^[A-Z]{2}$/.test(countryCode) ? countryCode : null },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
  );
}
