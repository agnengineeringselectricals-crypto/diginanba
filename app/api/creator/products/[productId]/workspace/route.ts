import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
type Context = { params: Promise<{ productId: string }> };

const fieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(80),
  type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'formula']),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string().max(500), z.number(), z.boolean(), z.null()]).optional(),
  options: z.array(z.string().max(100)).max(30).optional(),
  formula: z.string().max(500).optional()
});
const definitionSchema = z.object({
  editorProfile: z.enum(['student', 'freelancer', 'homemaker', 'educator', 'designer', 'developer', 'other']).default('other'),
  schemaVersion: z.literal(1).default(1),
  description: z.string().max(4000).default(''),
  fields: z.array(fieldSchema).max(100).default([])
});
const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'),
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(4000),
    definition: definitionSchema
  }),
  z.object({
    action: z.literal('confirm'),
    expectedVersion: z.number().int().positive(),
    reviewedContent: z.literal(true),
    rightsConfirmed: z.literal(true)
  })
]);

export async function POST(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to edit your private workspace.' }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid workspace update.', details: parsed.error.flatten() }, { status: 400 });
  const { productId } = await params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT p.id, p.title, p.description, p.status, p.moderation_status,
              b.id AS build_id, b.version_number, b.build_kind, b.definition_json, b.status AS build_status
       FROM products p
       JOIN LATERAL (SELECT * FROM product_builds WHERE product_id=p.id ORDER BY version_number DESC LIMIT 1) b ON true
       WHERE p.id=$1 AND p.creator_user_id=$2
       FOR UPDATE OF p`,
      [productId, session.user.id]
    );
    const row = result.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Workspace not found or access denied.' }, { status: 404 });
    }
    if (row.status !== 'draft' || ['approved', 'published', 'active'].includes(String(row.moderation_status))) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'This version is locked for review or publication. Create a new revision through the approved revision flow.' }, { status: 409 });
    }
    const input = parsed.data;
    if (Number(row.version_number) !== input.expectedVersion) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'A newer revision exists. Reload the workspace before saving.', currentVersion: Number(row.version_number) }, { status: 409 });
    }

    if (input.action === 'save') {
      const keys = input.definition.fields.map(field => field.key);
      if (new Set(keys).size !== keys.length) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Each workspace field must have a unique key.' }, { status: 400 });
      }
      const nextVersion = Number(row.version_number) + 1;
      await client.query(
        `INSERT INTO product_builds(product_id, created_by, version_number, build_kind, editor_kind, definition_json, validation_json, status)
         VALUES($1,$2,$3,$4,'native_builder',$5::jsonb,'{}'::jsonb,'draft')`,
        [productId, session.user.id, nextVersion, row.build_kind, JSON.stringify(input.definition)]
      );
      await client.query(
        `UPDATE products SET title=$2, description=$3, updated_at=now() WHERE id=$1 AND creator_user_id=$4 AND status='draft'`,
        [productId, input.title, input.description, session.user.id]
      );
      await client.query(
        `UPDATE product_editions SET title=$2, description=$3, status='draft'
         WHERE id=(SELECT id FROM product_editions WHERE product_id=$1 ORDER BY version DESC LIMIT 1)`,
        [productId, input.title, input.description]
      );
      const saved = await client.query(
        `SELECT id, version_number, status FROM product_builds WHERE product_id=$1 ORDER BY version_number DESC LIMIT 1`,
        [productId]
      );
      await client.query(
        `INSERT INTO product_build_revision_events(product_id, product_build_id, actor_user_id, event_type, details_json)
         VALUES($1,$2,$3,'saved_revision',$4::jsonb)`,
        [productId, saved.rows[0].id, session.user.id, JSON.stringify({ version: nextVersion, editor: 'native_builder', aiCalls: 0 })]
      );
      await client.query('COMMIT');
      return NextResponse.json({ build: saved.rows[0], message: 'Revision saved privately. No AI/token call was made.' });
    }

    const confirmation = await client.query(
      `INSERT INTO product_build_confirmations(product_id, product_build_id, creator_user_id, confirmation_kind, metadata_json)
       VALUES($1,$2,$3,'content_reviewed',$4::jsonb),($1,$2,$3,'rights_confirmed',$5::jsonb)
       RETURNING id, confirmation_kind, confirmed_at`,
      [productId, row.build_id, session.user.id, JSON.stringify({ version: row.version_number }), JSON.stringify({ version: row.version_number })]
    );
    await client.query(
      `INSERT INTO product_build_revision_events(product_id, product_build_id, actor_user_id, event_type, details_json)
       VALUES($1,$2,$3,'confirmed',$4::jsonb)`,
      [productId, row.build_id, session.user.id, JSON.stringify({ version: row.version_number, confirmations: confirmation.rows.map(item => item.confirmation_kind) })]
    );
    await client.query('COMMIT');
    return NextResponse.json({ confirmations: confirmation.rows, message: 'This exact version has been confirmed. It remains private and unpublished until separately submitted and approved.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Creator workspace update failed', error);
    return NextResponse.json({ error: 'Could not save the private workspace. Please retry.' }, { status: 503 });
  } finally {
    client.release();
  }
}
