import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const schema = z.object({
  productId: z.string().uuid(),
  buildId: z.string().uuid().optional(),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(5000),
  kind: z.enum(['feature','bug','content_correction','accessibility','localization','translation','performance','other']).default('feature'),
  locale: z.string().trim().max(20).optional(),
  visitorId: z.string().max(100).optional()
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please provide a product, a short title, and enough detail to review the improvement.' }, { status: 400 });
  const session = await auth().catch(() => null);
  const input = parsed.data;
  const visitorHash = input.visitorId ? createHash('sha256').update(input.visitorId).digest('hex') : null;
  try {
    const product = await db.query(`SELECT id FROM products WHERE id=$1 AND status='published'`, [input.productId]);
    if (!product.rowCount) return NextResponse.json({ error: 'Published product not found.' }, { status: 404 });
    const result = await db.query(
      `INSERT INTO product_improvement_suggestions(product_id,product_build_id,submitted_by,submitter_visitor_hash,title,description,suggestion_kind,target_locale)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,created_at`,
      [input.productId, input.buildId ?? null, session?.user?.id ?? null, visitorHash, input.title, input.description, input.kind, input.locale ?? null]
    );
    return NextResponse.json({ suggestion: result.rows[0], message: 'Suggestion submitted for review. Rewards are considered only under the published reward policy after review and verification.' }, { status: 201 });
  } catch (error) {
    console.error('Product improvement submission failed', error);
    return NextResponse.json({ error: 'Improvement suggestions are temporarily unavailable.' }, { status: 503 });
  }
}
