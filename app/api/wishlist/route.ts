import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const addSchema = z.object({ slug: z.string().trim().min(1).max(180) });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to sync your wishlist.' }, { status: 401 });
  try {
    const result = await db.query(
      `SELECT p.slug, p.title, COALESCE(c.name, 'Digital Products') AS category,
              COALESCE(pr.amount_minor, 0)::int AS "amountMinor",
              COALESCE(pr.currency_code, 'USD') AS currency
       FROM wishlists w
       JOIN products p ON p.id = w.product_id AND p.status = 'published'
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_editions pe ON pe.product_id = p.id AND pe.market_code = 'US' AND pe.status = 'published'
       LEFT JOIN prices pr ON pr.product_edition_id = pe.id AND pr.valid_to IS NULL
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [session.user.id],
    );
    const items = result.rows.map((row: any) => ({
      slug: row.slug,
      title: row.title,
      category: row.category,
      price: new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(Number(row.amountMinor) / 100),
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: 'Wishlist sync is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to sync your wishlist.' }, { status: 401 });
  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product.' }, { status: 400 });
  try {
    const product = await db.query(
      `SELECT id FROM products WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [parsed.data.slug],
    );
    if (!product.rows[0]) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    await db.query(
      `INSERT INTO wishlists(user_id, product_id) VALUES($1, $2)
       ON CONFLICT(user_id, product_id) DO NOTHING`,
      [session.user.id, product.rows[0].id],
    );
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Wishlist sync is temporarily unavailable.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to sync your wishlist.' }, { status: 401 });
  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product.' }, { status: 400 });
  try {
    await db.query(
      `DELETE FROM wishlists w USING products p
       WHERE w.product_id = p.id AND w.user_id = $1 AND p.slug = $2`,
      [session.user.id, parsed.data.slug],
    );
    return NextResponse.json({ saved: false });
  } catch {
    return NextResponse.json({ error: 'Wishlist sync is temporarily unavailable.' }, { status: 503 });
  }
}
