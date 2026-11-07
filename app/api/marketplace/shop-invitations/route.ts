import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in to invite a shop.' }, { status: 401 });

  try {
    const invitationCode = randomBytes(12).toString('base64url');
    const result = await db.query(
      `INSERT INTO marketplace_shop_invitations(invitation_code, inviter_user_id)
       VALUES($1,$2) RETURNING id, invitation_code, expires_at`,
      [invitationCode, userId]
    );
    await db.query(
      `INSERT INTO marketplace_shop_requests(requester_user_id, invitation_id, request_type)
       VALUES($1,$2,'invite')`,
      [userId, result.rows[0].id]
    );
    return NextResponse.json({
      invitationCode: result.rows[0].invitation_code,
      invitationPath: '/join/shop?invite=' + encodeURIComponent(result.rows[0].invitation_code),
      expiresAt: result.rows[0].expires_at
    }, { status: 201 });
  } catch (error) {
    console.error('Shop invitation creation failed', error);
    return NextResponse.json({ error: 'Could not create an invitation right now.' }, { status: 503 });
  }
}
