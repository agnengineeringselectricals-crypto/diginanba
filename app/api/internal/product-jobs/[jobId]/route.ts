import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Legacy queue transitions are disabled so all workflow changes use ai_factory_jobs.
export async function PATCH() {
  return NextResponse.json(
    { error: 'Legacy product factory is disabled. Use the private AI Factory jobs API.' },
    { status: 410 },
  );
}
