import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function getAccess(write = false) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, status: 401, error: 'Authentication required' };
  const result = await db.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1`,
    [userId],
  );
  const roles = new Set<string>(result.rows.map((row: { name: string }) => String(row.name)));
  const allowed = write ? ['Super Admin', 'Catalog Manager'] : ['Super Admin', 'Catalog Manager', 'Operations Admin'];
  if (!allowed.some(role => roles.has(role))) return { ok: false as const, status: 403, error: 'Not authorized for catalog management' };
  return { ok: true as const, userId };
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(5000).default(''),
  productType: z.enum(['ebook','guide','template','spreadsheet','course','asset','tool']).default('template'),
});
const priceSchema = z.object({\n  action: z.literal('price'),\n  productId: z.string().uuid(),\n  marketCode: z.enum(['US','UK']),\n  amountMinor: z.number().int().positive().max(100000000),\n});\nconst updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(5000),
  productType: z.enum(['ebook','guide','template','spreadsheet','course','asset','tool']),
  status: z.enum(['draft','published','archived']),
});

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150) || 'digital-product';
}

export async function GET() {
  const access = await getAccess(false);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const result = await db.query(
      `SELECT p.id,p.slug,p.title,p.description,p.product_type,p.status,p.created_at,c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id=p.category_id
       ORDER BY p.created_at DESC LIMIT 200`,
    );
    return NextResponse.json({ products: result.rows });
  } catch {
    return NextResponse.json({ error: 'Unable to load catalog. Check database connectivity and schema.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await getAccess(true);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => null);
  if (body && typeof body === 'object' && (body as { action?: unknown }).action === 'price') {
    const price = priceSchema.safeParse(body);
    if (!price.success) return NextResponse.json({ error: 'Invalid market price fields', issues: price.error.issues }, { status: 400 });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const productResult = await client.query('SELECT id,title,description FROM products WHERE id=$1 FOR UPDATE', [price.data.productId]);
      const product = productResult.rows[0];
      if (!product) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Product not found' }, { status: 404 }); }
      const market = price.data.marketCode;
      const currency = market === 'US' ? 'USD' : 'GBP';
      const locale = market === 'US' ? 'en-US' : 'en-GB';
      const edition = await client.query(
        `INSERT INTO product_editions(product_id,market_code,locale,title,description,status,version)
         VALUES($1,$2,$3,$4,$5,'published','1.0')
         ON CONFLICT(product_id,market_code,locale,version) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,status='published'
         RETURNING id`,
        [product.id, market, locale, product.title, product.description || ''],
      );
      const editionId = edition.rows[0].id;
      const currentPrice = await client.query(
        'SELECT id FROM prices WHERE product_edition_id=$1 AND currency_code=$2 AND valid_to IS NULL ORDER BY valid_from DESC LIMIT 1 FOR UPDATE',
        [editionId, currency],
      );
      if (currentPrice.rows[0]) {
        await client.query('UPDATE prices SET amount_minor=$2,valid_from=now() WHERE id=$1', [currentPrice.rows[0].id, price.data.amountMinor]);
      } else {
        await client.query('INSERT INTO prices(product_edition_id,currency_code,amount_minor) VALUES($1,$2,$3)', [editionId, currency, price.data.amountMinor]);
      }
      await client.query(
        `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,after_json,result)
         VALUES($1,'product.price_updated','product',$2,$3::jsonb,'success')`,
        [access.userId, product.id, JSON.stringify({ market, locale, currency, amountMinor: price.data.amountMinor })],
      );
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, market, locale, currency, amountMinor: price.data.amountMinor });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('[admin:catalog] price update failed', error);
      return NextResponse.json({ error: 'Market edition or price could not be saved.' }, { status: 503 });
    } finally { client.release(); }
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product fields', issues: parsed.error.issues }, { status: 400 });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const baseSlug = slugify(parsed.data.title);
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
    const result = await client.query(
      `INSERT INTO products(slug,title,description,product_type,owner_type,status)
       VALUES($1,$2,$3,$4,'platform','draft')
       RETURNING id,slug,title,description,product_type,status,created_at`,
      [slug, parsed.data.title, parsed.data.description, parsed.data.productType],
    );
    const product = result.rows[0];
    await client.query(
      `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,after_json,result)
       VALUES($1,'product.created','product',$2,$3::jsonb,'success')`,
      [access.userId, product.id, JSON.stringify({ title: product.title, status: product.status })],
    );
    await client.query('COMMIT');
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[admin:catalog] product creation failed', error);
    return NextResponse.json({ error: 'Product could not be created. Check database logs and try again.' }, { status: 503 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request) {
  const access = await getAccess(true);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product update', issues: parsed.error.issues }, { status: 400 });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const beforeResult = await client.query('SELECT id,title,description,product_type,status FROM products WHERE id=$1 FOR UPDATE', [parsed.data.id]);
    const before = beforeResult.rows[0];
    if (!before) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (parsed.data.status === 'published' && (!parsed.data.description.trim() || parsed.data.title.trim().length < 3)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Add a clear description before publishing this product.' }, { status: 400 });
    }
    if (parsed.data.status === 'published') {
      const pricing = await client.query(
        `SELECT COUNT(*)::int AS count FROM product_editions pe
         JOIN prices pr ON pr.product_edition_id = pe.id AND pr.valid_to IS NULL
         WHERE pe.product_id = $1 AND pe.status = 'published' AND pr.amount_minor >= 0`,
        [parsed.data.id],
      );
      if (Number(pricing.rows[0]?.count ?? 0) < 1) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'This product cannot be published yet. Add a published market edition and an active price first. The current schema does not yet verify downloadable asset availability.' }, { status: 400 });
      }
    }
    const result = await client.query(
      `UPDATE products SET title=$2,description=$3,product_type=$4,status=$5,updated_at=now()
       WHERE id=$1 RETURNING id,slug,title,description,product_type,status,created_at`,
      [parsed.data.id, parsed.data.title, parsed.data.description, parsed.data.productType, parsed.data.status],
    );
    const product = result.rows[0];
    await client.query(
      `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,before_json,after_json,result)
       VALUES($1,'product.updated','product',$2,$3::jsonb,$4::jsonb,'success')`,
      [access.userId, product.id, JSON.stringify(before), JSON.stringify({ title: product.title, status: product.status, productType: product.product_type })],
    );
    await client.query('COMMIT');
    return NextResponse.json({ product });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[admin:catalog] product update failed', error);
    return NextResponse.json({ error: 'Product could not be updated. Check database logs and try again.' }, { status: 503 });
  } finally {
    client.release();
  }
}
