import 'server-only';
import { db } from '@/lib/db';

export type CheckoutLine = { slug: string; quantity: number };

export async function createPendingOrder(userId: string, market: 'US'|'UK', lines: CheckoutLine[]) {
  if (!lines.length) throw new Error('Cart is empty');
  const currency = market === 'US' ? 'USD' : 'GBP';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const values: { editionId:string; amount:number; quantity:number }[] = [];
    for (const line of lines) {
      const quantity = Math.max(1, Math.min(10, Number(line.quantity) || 1));
      const r = await client.query(`SELECT pe.id, pr.amount_minor FROM products p JOIN product_editions pe ON pe.product_id=p.id AND pe.market_code=$2 AND pe.status='published' JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL WHERE p.slug=$1 AND p.status='published' LIMIT 1`, [line.slug, market]);
      if (!r.rows[0]) throw new Error(`Product unavailable: ${line.slug}`);
      values.push({ editionId:r.rows[0].id, amount:Number(r.rows[0].amount_minor), quantity });
    }
    const subtotal = values.reduce((sum,x)=>sum+x.amount*x.quantity,0);
    const order = await client.query(`INSERT INTO orders(user_id,market_code,currency_code,subtotal_minor,tax_minor,total_minor,status) VALUES($1,$2,$3,$4,0,$4,'pending') RETURNING id`, [userId,market,currency,subtotal]);
    for (const x of values) await client.query(`INSERT INTO order_items(order_id,product_edition_id,quantity,unit_amount_minor,total_amount_minor) VALUES($1,$2,$3,$4,$5)`, [order.rows[0].id,x.editionId,x.quantity,x.amount,x.amount*x.quantity]);
    await client.query('COMMIT');
    return { id:order.rows[0].id, currency, subtotalMinor:subtotal };
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
