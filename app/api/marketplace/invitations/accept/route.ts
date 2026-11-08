import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Please sign in to accept this invitation.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invitation link is invalid.' }, { status: 400 });
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT i.*, a.owner_user_id AS workspace_owner_id, a.display_name
       FROM marketplace_relationship_invitations i
       LEFT JOIN marketplace_customer_accounts a ON a.id=i.workspace_account_id
       WHERE i.token_hash=$1 FOR UPDATE OF i`,
      [tokenHash],
    );
    if (!found.rowCount) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 }); }
    const invitation = found.rows[0];
    if (invitation.status === 'accepted') {
      const accepted = await client.query('SELECT accepted_by_user_id,accepted_role FROM marketplace_relationship_invitation_acceptances WHERE invitation_id=$1', [invitation.id]);
      if (accepted.rows[0]?.accepted_by_user_id === userId) {
        await client.query('COMMIT');
        return NextResponse.json({ accepted: true, redirectTo: accepted.rows[0].accepted_role === 'owner' ? '/seller/customers' : '/account', alreadyAccepted: true });
      }
      await client.query('ROLLBACK'); return NextResponse.json({ error: 'This invitation has already been used.' }, { status: 409 });
    }
    if (invitation.status !== 'pending' || new Date(invitation.expires_at).getTime() <= Date.now()) {
      if (invitation.status === 'pending') await client.query("UPDATE marketplace_relationship_invitations SET status='expired',updated_at=now() WHERE id=$1", [invitation.id]);
      await client.query('COMMIT');
      return NextResponse.json({ error: 'This invitation has expired or was revoked.' }, { status: 410 });
    }
    if (invitation.inviter_user_id === userId) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'You cannot accept your own invitation.' }, { status: 400 }); }

    const acceptedRole = invitation.direction === 'owner_to_customer' ? 'customer' : 'owner';
    let accountId: string | null = invitation.workspace_account_id;
    let ownerUserId: string | null = invitation.workspace_owner_id;
    let workspaceName = invitation.display_name || 'your shop';

    if (acceptedRole === 'owner') {
      if (ownerUserId && ownerUserId !== userId) {
        await client.query('ROLLBACK'); return NextResponse.json({ error: 'Only the invited workspace owner can accept this link.' }, { status: 403 });
      }
      if (!accountId) {
        const business = await client.query(
          "SELECT id,business_name FROM marketplace_businesses WHERE owner_user_id=$1 AND business_type='shop' ORDER BY created_at ASC LIMIT 1",
          [userId],
        );
        if (!business.rowCount) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Register your shop first, then open this invitation link again to connect the customer.' }, { status: 409 });
        }
        workspaceName = business.rows[0].business_name;
        const account = await client.query(
          `INSERT INTO marketplace_customer_accounts(owner_user_id,workspace_key,category_key,display_name,workspace_ref)
           VALUES($1,$2,'shops',$3,$4)
           ON CONFLICT(owner_user_id,workspace_key) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=now()
           RETURNING id`,
          [userId,'shop:'+business.rows[0].id,workspaceName,business.rows[0].id],
        );
        accountId = account.rows[0].id;
        ownerUserId = userId;
        await client.query(
          "UPDATE marketplace_relationship_invitations SET workspace_account_id=$2,workspace_key=$3,updated_at=now() WHERE id=$1",
          [invitation.id,accountId,'shop:'+business.rows[0].id],
        );
      }
      if (ownerUserId && ownerUserId !== userId) {
        await client.query('ROLLBACK'); return NextResponse.json({ error: 'This invitation belongs to a different shop owner.' }, { status: 403 });
      }
    } else {
      if (!accountId || !ownerUserId || ownerUserId === userId) {
        await client.query('ROLLBACK'); return NextResponse.json({ error: 'This shop invitation is not valid for this account.' }, { status: 400 });
      }
    }

    const customerUserId = acceptedRole === 'customer' ? userId : invitation.inviter_user_id;
    const initiatedByRole = invitation.direction === 'owner_to_customer' ? 'owner' : 'customer';
    const relationship = await client.query(
      `INSERT INTO marketplace_customer_workspace_connections
       (workspace_account_id,owner_user_id,customer_user_id,source_invitation_id,initiated_by_user_id,initiated_by_role,status,connected_at,disconnected_at)
       VALUES($1,$2,$3,$4,$5,$6,'connected',now(),NULL)
       ON CONFLICT(workspace_account_id,owner_user_id,customer_user_id)
       DO UPDATE SET status='connected',source_invitation_id=EXCLUDED.source_invitation_id,connected_at=now(),disconnected_at=NULL,updated_at=now()
       RETURNING id`,
      [accountId,ownerUserId,customerUserId,invitation.id,invitation.inviter_user_id,initiatedByRole],
    );
    const customer = await client.query('SELECT display_name,email FROM users WHERE id=$1', [customerUserId]);
    const fullName = customer.rows[0]?.display_name || customer.rows[0]?.email || 'DigiNanba customer';
    await client.query(
      `INSERT INTO marketplace_customers(account_id,owner_user_id,full_name,source,source_reference,status)
       SELECT $1,$2,$3,'referral',$4,'active'
       WHERE NOT EXISTS (SELECT 1 FROM marketplace_customers WHERE account_id=$1 AND owner_user_id=$2 AND source_reference=$4)`,
      [accountId,ownerUserId,fullName,invitation.id],
    );
    await client.query(
      "INSERT INTO marketplace_relationship_invitation_acceptances(invitation_id,accepted_by_user_id,accepted_role) VALUES($1,$2,$3)",
      [invitation.id,userId,acceptedRole],
    );
    await client.query("UPDATE marketplace_relationship_invitations SET status='accepted',invitee_user_id=$2,accepted_at=now(),updated_at=now() WHERE id=$1", [invitation.id,userId]);
    await client.query('COMMIT');
    return NextResponse.json({
      accepted: true,
      relationshipId: relationship.rows[0].id,
      redirectTo: acceptedRole === 'customer' ? '/account' : '/seller/customers',
      connectedWorkspace: workspaceName,
      message: acceptedRole === 'customer' ? 'Shop connected to your DigiNanba account.' : 'The inviting customer has been added to your CRM customer list.',
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Accept reciprocal invitation failed', error);
    return NextResponse.json({ error: 'Could not accept this invitation right now.' }, { status: 503 });
  } finally {
    client.release();
  }
}
