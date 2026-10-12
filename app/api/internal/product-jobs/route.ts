import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Legacy queue intentionally disabled; do not create or list jobs here.
export async function GET() {
  return NextResponse.json(
    { error: 'Legacy product factory is disabled. Use the private AI Factory jobs API.' },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Legacy product factory is disabled. Use the private AI Factory jobs API.' },
    { status: 410 },
  );
}
