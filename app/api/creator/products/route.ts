import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(4000).default(''),
  categoryId: z.string().uuid().optional(),
  market: z.enum(['US', 'UK', 'IN']).default('IN'),
  locale: z.string().trim().min(2).max(20).default('en-IN'),
  currency: z.enum(['USD', 'GBP', 'INR']).default('INR'),
  priceMinor: z.number().int().min(0).max(100000000).default(0),
  buildKind: z.enum(['interactive_tool', 'spreadsheet', 'template', 'ebook', 'course', 'other']).default('interactive_tool'),
  definition: z.object({
    schemaVersion: z.literal(1).default(1),
    description: z.string().max(4000).default(''),
    fields: z.array(z.object({
      key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
      label: z.string().trim().min(1).max(80),
      type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'formula']),
      required: z.boolean().default(false),
      defaultValue: z.union([z.string().max(500), z.number(), z.boolean(), z.null()]).optional(),
      options: z.array(z.string().max(100)).max(30).optional(),
      formula: z.string().max(500).optional()
    })).max(100).default([])
  }).default({schemaVersion: 1, description: '', fields: []})
});

function slugify(value: string) {
  const slug = value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
  return slug || 'creator-product';
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const result = await db.query(
      `SELECT p.id, p.slug, p.title, p.description, p.status, p.moderation_status, p.created_at,
              b.id AS build_id, b.version_number, b.build_kind, b.status AS build_status,
              pe.market_code, pe.locale
       FROM products p
       LEFT JOIN LATERAL (
         SELECT id, version_number, build_kind, status
         FROM product_builds WHERE product_id=p.id
         ORDER BY version_number DESC LIMIT 1
       ) b ON true
       LEFT JOIN LATERAL (
         SELECT market_code, locale FROM product_editions
         WHERE product_id=p.id ORDER BY version DESC LIMIT 1
       ) pe ON true
       WHERE p.creator_user_id=$1
       ORDER BY p.updated_at DESC LIMIT 100`,
      [session.user.id]
    );
    return NextResponse.json({ products: result.rows });
  } catch (error) {
    console.error('Creator product listing failed', error);
    return NextResponse.json({ error: 'Creator workspace is not ready yet. Apply migration 011 and retry.' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product details', details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const creator = await client.query(
      `SELECT u.account_type, cp.application_status
       FROM users u LEFT JOIN creator_profiles cp ON cp.user_id=u.id
       WHERE u.id=$1 AND u.status='active' FOR UPDATE OF u`,
      [session.user.id]
    );
    if (!creator.rows[0] || creator.rows[0].account_type !== 'creator' || creator.rows[0].application_status !== 'approved') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Creator access requires an approved creator profile.' }, { status: 403 });
    }

    const baseSlug = slugify(input.title);
    let slug = baseSlug;
    for (let attempt = 0; attempt < 4; attempt++) {
      const exists = await client.query('SELECT 1 FROM products WHERE slug=$1', [slug]);
      if (!exists.rowCount) break;
      slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
    }

    const product = await client.query(
      `INSERT INTO products(category_id, slug, title, description, product_type, owner_type, creator_user_id, status, moderation_status)
       VALUES($1,$2,$3,$4,$5,'creator',$6,'draft','pending')
       RETURNING id, slug, title, status`,
      [input.categoryId ?? null, slug, input.title, input.description, input.buildKind, session.user.id]
    );
    const p = product.rows[0];
    await client.query(
      `INSERT INTO product_editions(product_id, market_code, locale, title, description, status)
       VALUES($1,$2,$3,$4,$5,'draft')`,
      [p.id, input.market, input.locale, input.title, input.description]
    );
    const build = await client.query(
      `INSERT INTO product_builds(product_id, created_by, version_number, build_kind, definition_json, status)
       VALUES($1,$2,1,$3,$4::jsonb,'draft') RETURNING id, version_number, status`,
      [p.id, session.user.id, input.buildKind, JSON.stringify(input.definition)]
    );
    if (input.priceMinor > 0) {
      await client.query(
        `INSERT INTO prices(product_edition_id,currency_code,amount_minor)
         SELECT id,$2,$3 FROM product_editions WHERE product_id=$1 AND market_code=$4 AND locale=$5`,
        [p.id, input.currency, input.priceMinor, input.market, input.locale]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ product: p, build: build.rows[0], message: 'Draft created. Validate and submit it for publication review before selling.' }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Creator product creation failed', error);
    return NextResponse.json({ error: 'Could not create product draft.' }, { status: 500 });
  } finally {
    client.release();
  }
}
