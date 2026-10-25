import { createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function POST(request: Request) {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Enter a valid reset link and a password of 8–128 characters.' }, { status: 400 });
  }

  const tokenHash = sha256(input.token);
  const passwordHash = await hash(input.password, 12);
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND channel = 'email'
         AND consumed_at IS NULL
         AND expires_at > now()
       FOR UPDATE`,
      [tokenHash],
    );

    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });
    }

    const tokenRow = found.rows[0];
    const updated = await client.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
      [passwordHash, tokenRow.user_id],
    );

    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });
    }

    await client.query(
      'UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL',
      [tokenRow.user_id],
    );
    await client.query('COMMIT');

    return NextResponse.json({ message: 'Password updated. You can now sign in with your new password.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Password reset confirmation failed.');
    return NextResponse.json({ error: 'Unable to reset the password right now. Please try again.' }, { status: 500 });
  } finally {
    client.release();
  }
}
