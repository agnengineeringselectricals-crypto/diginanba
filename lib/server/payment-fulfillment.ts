import 'server-only';
import type { PoolClient } from 'pg';

/** Idempotently grant purchase entitlements only for a confirmed paid order. */
export async function grantPaidOrderEntitlements(client: PoolClient, orderId: string) {
  const order = await client.query(
    `SELECT user_id, status FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId],
  );
  const row = order.rows[0];
  if (!row || row.status !== 'paid' || !row.user_id) return 0;
  const granted = await client.query(
    `INSERT INTO entitlements(user_id, order_item_id, status)
     SELECT $1, oi.id, 'active'
     FROM order_items oi
     WHERE oi.order_id = $2
     ON CONFLICT (user_id, order_item_id)
     DO UPDATE SET status = 'active'`,
    [row.user_id, orderId],
  );
  return granted.rowCount ?? 0;
}
