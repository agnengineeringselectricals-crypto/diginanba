import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { PoolClient } from 'pg';

const preferencesSchema = z.object({
  market: z.enum(['US', 'UK', 'IN']).default('IN'),
  language: z.string().trim().min(1).max(40).default('English'),
  emailOffers: z.boolean().default(false),
  productUpdates: z.boolean().default(true),
  wishlistAlerts: z.boolean().default(true),
  creatorUpdates: z.boolean().default(true),
  personalizedDiscovery: z.boolean().default(true),
  promotionEmails: z.boolean().default(false),
  rewardAlerts: z.boolean().default(true),
  referralUpdates: z.boolean().default(false),
  creatorNewsletter: z.boolean().default(false),
  saveSearchHistory: z.boolean().default(true),
  reducedMotion: z.boolean().default(false),
  compactCards: z.boolean().default(false),
});

const consentKeys = ['promotionEmails', 'referralUpdates', 'creatorNewsletter'] as const;
const consentTypes = {
  promotionEmails: 'promotion_emails',
  referralUpdates: 'referral_updates',
  creatorNewsletter: 'creator_newsletter',
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to load account preferences.' }, { status: 401 });
  try {
    const result = await db.query('SELECT preferences, updated_at FROM user_preferences WHERE user_id = $1', [session.user.id]);
    return NextResponse.json({ preferences: result.rows[0]?.preferences ?? null, updatedAt: result.rows[0]?.updated_at ?? null });
  } catch (error) {
    console.error('Unable to load account preferences', error);
    return NextResponse.json({ error: 'Preferences are temporarily unavailable.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to save account preferences.' }, { status: 401 });
  const parsed = preferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid preferences. Review the fields and try again.' }, { status: 400 });
  const preferences = parsed.data;
  let client: PoolClient | undefined;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    const previousResult = await client.query('SELECT preferences FROM user_preferences WHERE user_id = $1 FOR UPDATE', [session.user.id]);
    const previous = previousResult.rows[0]?.preferences ?? {};
    await client.query(
      `INSERT INTO user_preferences(user_id, preferences, updated_at)
       VALUES($1, $2::jsonb, now())
       ON CONFLICT(user_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = now()`,
      [session.user.id, JSON.stringify(preferences)],
    );
    for (const key of consentKeys) {
      if (previous[key] !== preferences[key]) {
        await client.query(
          'INSERT INTO user_marketing_consent_events(user_id, consent_type, enabled) VALUES($1, $2, $3)',
          [session.user.id, consentTypes[key], preferences[key]],
        );
      }
    }
    await client.query('COMMIT');
    return NextResponse.json({ saved: true, preferences, updatedAt: new Date().toISOString() });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Unable to save account preferences', error);
    return NextResponse.json({ error: 'Preferences could not be saved. Please try again.' }, { status: 503 });
  } finally {
    client?.release();
  }
}
