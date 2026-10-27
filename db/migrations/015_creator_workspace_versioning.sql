-- Creator workspace: explicit confirmations and immutable revision audit.
BEGIN;

CREATE TABLE IF NOT EXISTS product_build_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_build_id UUID NOT NULL REFERENCES product_builds(id) ON DELETE RESTRICT,
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  confirmation_kind TEXT NOT NULL CHECK (confirmation_kind IN ('content_reviewed','rights_confirmed','publish_submission')),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS product_build_confirmations_product_build_idx
  ON product_build_confirmations(product_id, product_build_id, confirmed_at DESC);

CREATE TABLE IF NOT EXISTS product_build_revision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_build_id UUID NOT NULL REFERENCES product_builds(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','saved_revision','confirmed','submitted_for_review','archived')),
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_build_revision_events_product_created_idx
  ON product_build_revision_events(product_id, created_at DESC);

COMMIT;
