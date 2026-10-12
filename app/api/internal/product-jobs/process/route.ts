import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Legacy worker intentionally disabled. All new work must use /api/internal/ai-factory/worker.
export async function GET() {
  return NextResponse.json(
    { error: 'Legacy product factory is disabled. Use the private AI Factory worker.' },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Legacy product factory is disabled. Use the private AI Factory worker.' },
    { status: 410 },
  );
}
