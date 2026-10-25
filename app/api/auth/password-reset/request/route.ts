import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().trim().email().max(254) });
const genericMessage = 'If an account exists for that email, password-reset instructions will be sent shortly.';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getClientIp(request: Request) {
  // Vercel provides x-real-ip for the direct client address.
  return request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function POST(request: Request) {
  let email = '';
  try {
    const body = schema.parse(await request.json());
    email = body.email.toLowerCase();
  } catch {
    // Keep the response generic so account-recovery requests do not reveal
    // whether a particular address is registered.
    return NextResponse.json({ message: genericMessage });
  }

  const emailKey = sha256(email);
  const ipKey = sha256(getClientIp(request));
  const client = await db.connect();
  let allowed = false;

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [emailKey, ipKey]);

    const counts = await client.query(
      `SELECT
        (SELECT count(*)::int FROM password_reset_request_events WHERE email_key = $1 AND created_at > now() - interval '1 hour') AS email_count,
        (SELECT count(*)::int FROM password_reset_request_events WHERE ip_key = $2 AND created_at > now() - interval '1 hour') AS ip_count`,
      [emailKey, ipKey],
    );

    const emailCount = Number(counts.rows[0]?.email_count ?? 0);
    const ipCount = Number(counts.rows[0]?.ip_count ?? 0);
    allowed = emailCount < 3 && ipCount < 10;

    if (allowed) {
      await client.query(
        'INSERT INTO password_reset_request_events(email_key, ip_key) VALUES ($1, $2)',
        [emailKey, ipKey],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Password recovery request could not be rate-limited safely.');
    return NextResponse.json({ message: genericMessage });
  } finally {
    client.release();
  }

  if (!allowed) return NextResponse.json({ message: genericMessage });

  const from = process.env.PASSWORD_RESET_FROM_EMAIL || process.env.EMAIL_FROM;
  const resendKey = process.env.RESEND_API_KEY;
  if (!from || !resendKey) {
    console.error('Password recovery email is not configured.');
    return NextResponse.json({ message: genericMessage });
  }

  try {
    const userResult = await db.query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
    if (!userResult.rowCount) return NextResponse.json({ message: genericMessage });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const inserted = await db.query(
      `INSERT INTO password_reset_tokens(user_id, token_hash, channel, expires_at)
       VALUES ($1, $2, 'email', now() + interval '30 minutes')
       RETURNING id`,
      [userResult.rows[0].id, tokenHash],
    );

    const baseUrl = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://www.diginanba.com').replace(/\/$/, '');
    const resetUrl = baseUrl + '/reset-password?token=' + encodeURIComponent(token);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Reset your DigiNanba password',
        text: 'We received a request to reset your DigiNanba password. This link expires in 30 minutes and can be used once:\n\n' + resetUrl + '\n\nIf you did not request this, you can ignore this email.',
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      await db.query('DELETE FROM password_reset_tokens WHERE id = $1 AND consumed_at IS NULL', [inserted.rows[0].id]);
      console.error('Password recovery email provider returned status:', response.status);
    }
  } catch (error) {
    console.error('Password recovery delivery failed:', error instanceof Error ? error.name : 'unknown error');
  }

  return NextResponse.json({ message: genericMessage });
}
