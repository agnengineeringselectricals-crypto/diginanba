import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = z.object({ displayName: z.string().trim().min(2).max(100) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Enter a valid creator display name.' }, { status: 400 });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE users SET account_type='creator', updated_at=now() WHERE id=$1 AND status='active'", [session.user.id]);
    const result = await client.query(
      `INSERT INTO creator_profiles(user_id, display_name, application_status)
       VALUES($1,$2,'pending')
       ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name, updated_at=now()
       RETURNING application_status`,
      [session.user.id, body.data.displayName]
    );
    await client.query('COMMIT');
    return NextResponse.json({ applicationStatus: result.rows[0].application_status, message: 'Creator application submitted. Product creation unlocks after approval.' }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Creator application failed', error);
    return NextResponse.json({ error: 'Creator applications are not ready yet. Apply migration 011 and retry.' }, { status: 503 });
  } finally { client.release(); }
}
