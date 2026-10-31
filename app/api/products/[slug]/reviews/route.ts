import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

type RouteContext = { params: Promise<{ slug: string }> };
const ratingSchema = z.object({ rating: z.number().int().min(1).max(5) });

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const session = await auth();
  try {
    const result = await db.query(
      `SELECT r.id, r.rating, r.created_at AS "createdAt"
       FROM product_reviews r
       JOIN products p ON p.id = r.product_id
       WHERE p.slug = $1 AND r.status = 'published'
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [slug],
    );
    let canRate = false;
    let userRating: number | null = null;
    if (session?.user?.id) {
      const purchase = await db.query(
        `SELECT r.rating
         FROM products p
         JOIN product_editions pe ON pe.product_id = p.id
         JOIN order_items oi ON oi.product_edition_id = pe.id
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN product_reviews r ON r.product_id = p.id AND r.user_id = o.user_id
         WHERE p.slug = $1 AND o.user_id = $2
           AND o.status IN ('paid', 'completed', 'fulfilled')
         ORDER BY o.created_at DESC
         LIMIT 1`,
        [slug, session.user.id],
      );
      canRate = purchase.rows.length > 0;
      userRating = purchase.rows[0]?.rating ?? null;
    }
    return NextResponse.json({ reviews: result.rows, canRate, userRating });
  } catch {
    return NextResponse.json({ error: 'Ratings are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in and purchase this product before rating it.' }, { status: 401 });
  }

  const parsed = ratingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Select a rating from 1 to 5 stars.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Only customers who completed a purchase can rate this product.' }, { status: 403 });
    }

    const saved = await client.query(
      `INSERT INTO product_reviews (product_id, user_id, order_id, rating, review_text, status)
       VALUES ($1, $2, $3, $4, '', 'published')
       ON CONFLICT (product_id, user_id)
       DO UPDATE SET order_id = EXCLUDED.order_id,
                     rating = EXCLUDED.rating,
                     status = 'published',
                     updated_at = now()
       RETURNING id, rating, created_at AS "createdAt"`,
      [product.rows[0].id, session.user.id, purchase.rows[0].order_id, parsed.data.rating],
    );
    return NextResponse.json({ review: saved.rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to save your rating right now.' }, { status: 503 });
  } finally {
    client.release();
  }
}
