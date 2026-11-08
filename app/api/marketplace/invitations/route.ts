import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
const schema = z.discriminatedUnion('direction', [
  z.object({ direction: z.literal('owner_to_customer'), businessId: z.string().uuid(), channel: z.enum(['link','whatsapp','sms']).default('link') }),
  z.object({ direction: z.literal('customer_to_owner'), workspaceAccountId: z.string().uuid(), channel: z.enum(['link','whatsapp','sms']).default('link') }),
]);

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in to create an invitation.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid invitation details.' }, { status: 400 });
  const data = parsed.data;
  try {
    let accountId: string;
    let categoryKey: string;
    let workspaceKey: string;
    if (data.direction === 'owner_to_customer') {
      const business = await db.query(
        "SELECT id, business_name, owner_user_id FROM marketplace_businesses WHERE id=$1 AND owner_user_id=$2 AND business_type='shop' LIMIT 1",
        [data.businessId, userId],
      );
      if (!business.rowCount) return NextResponse.json({ error: 'Shop not found or not owned by your account.' }, { status: 404 });
      workspaceKey = 'shop:' + business.rows[0].id;
      categoryKey = 'shops';
      const account = await db.query(
        `INSERT INTO marketplace_customer_accounts(owner_user_id,workspace_key,category_key,display_name,workspace_ref)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(owner_user_id,workspace_key) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=now()
         RETURNING id`,
        [userId, workspaceKey, categoryKey, business.rows[0].business_name, business.rows[0].id],
      );
      accountId = account.rows[0].id;
    } else {
      const account = await db.query(
        "SELECT id,owner_user_id,workspace_key,category_key FROM marketplace_customer_accounts WHERE id=$1 AND status='active' LIMIT 1",
        [data.workspaceAccountId],
      );
      if (!account.rowCount || account.rows[0].owner_user_id === userId) return NextResponse.json({ error: 'Workspace not found or invitation is not allowed.' }, { status: 404 });
      accountId = account.rows[0].id;
      workspaceKey = account.rows[0].workspace_key;
      categoryKey = account.rows[0].category_key;
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const result = await db.query(
      `INSERT INTO marketplace_relationship_invitations
       (token_hash,direction,inviter_user_id,workspace_account_id,category_key,workspace_key,message_channel)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,expires_at`,
      [tokenHash,data.direction,userId,accountId,categoryKey,workspaceKey,data.channel],
    );
    const invitationPath = '/invite/accept?token=' + encodeURIComponent(token);
    return NextResponse.json({ invitationId: result.rows[0].id, invitationPath, expiresAt: result.rows[0].expires_at }, { status: 201 });
  } catch (error) {
    console.error('Create reciprocal invitation failed', error);
    return NextResponse.json({ error: 'Could not create an invitation right now.' }, { status: 503 });
  }
}
