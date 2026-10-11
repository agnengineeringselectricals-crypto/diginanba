import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

type RouteContext = { params: Promise<{ slug: string }> };
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(2000),
});

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  try {
    const result = await db.query(
      `SELECT r.id, r.rating, r.review_text AS text,
              COALESCE(u.display_name, 'Verified customer') AS name,
              r.created_at AS "createdAt", true AS "verifiedPurchase"
       FROM product_reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       WHERE p.slug = $1 AND r.status = 'published'
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [slug],
    );
    return NextResponse.json({ reviews: result.rows });
  } catch {
    return NextResponse.json({ error: 'Reviews are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to leave a review.' }, { status: 401 });
  }

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a rating and a review of up to 2,000 characters.' }, { status: 400 });
  }

  const { slug } = await params;
  const client = await db.connect();
  try {
    const product = await client.query(
      `SELECT id FROM products WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [slug],
    );
    if (!product.rows[0]) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    const purchase = await client.query(
      `SELECT o.id AS order_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_editions pe ON pe.id = oi.product_edition_id
       WHERE o.user_id = $1
         AND pe.product_id = $2
         AND o.status IN ('paid', 'completed', 'fulfilled')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [session.user.id, product.rows[0].id],
    );
    if (!purchase.rows[0]) {
      return NextResponse.json({ error: 'Reviews are available only after a completed purchase.' }, { status: 403 });
    }

    const saved = await client.query(
      `INSERT INTO product_reviews (product_id, user_id, order_id, rating, review_text, status)
       VALUES ($1, $2, $3, $4, $5, 'published')
       ON CONFLICT (product_id, user_id)
       DO UPDATE SET order_id = EXCLUDED.order_id,
                     rating = EXCLUDED.rating,
                     review_text = EXCLUDED.review_text,
                     status = 'published',
                     updated_at = now()
       RETURNING id, rating, review_text AS text, true AS "verifiedPurchase", created_at AS "createdAt"`,
      [product.rows[0].id, session.user.id, purchase.rows[0].order_id, parsed.data.rating, parsed.data.text],
    );
    return NextResponse.json({ review: { ...saved.rows[0], name: session.user.name || 'Verified customer' } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to save your review right now.' }, { status: 503 });
  } finally {
    client.release();
  }
}
