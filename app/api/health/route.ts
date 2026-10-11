import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await db.query('SELECT 1');
    return NextResponse.json({
      ok: true,
      service: 'diginanba-web',
      database: 'connected',
      environment: process.env.NODE_ENV,
    });
  } catch {
    return NextResponse.json(
      { ok: false, service: 'diginanba-web', database: 'unavailable' },
      { status: 503 },
    );
  }
}
