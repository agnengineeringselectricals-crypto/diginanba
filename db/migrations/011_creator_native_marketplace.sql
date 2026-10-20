-- DigiNanba creator-native marketplace foundation.
-- Additive and safe to apply to existing installations. Does not enable payments or payouts.
BEGIN,

-- Every listing has an accountable owner. Existing platform products remain platform-owned.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

CREATE INDEX IF NOT EXISTS products_creator_status_updated_idx
  ON products(creator_user_id, status, updated_at DESC),

-- Creator-facing profile and review/payout readiness. Payment provider onboarding is stored as references only.
CREATE TABLE IF NOT EXISTS creator_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  public_slug TEXT UNIQUE,
  bio TEXT,
  avatar_asset_key TEXT,
  application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending','approved','rejected','suspended')),
  payout_country_code CHAR(2),
  payout_currency_code CHAR(3),
  payout_provider TEXT,
  payout_account_reference TEXT,
  payout_onboarding_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (payout_onboarding_status IN ('not_started','pending','verified','restricted')),
  tax_profile_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (tax_profile_status IN ('not_started','pending','verified','needs_review')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
),

-- Files/assets are private by default, download access must be checked against entitlements.
CREATE TABLE IF NOT EXISTS product_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_edition_id UUID REFERENCES product_editions(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  asset_kind TEXT NOT NULL
    CHECK (asset_kind IN ('download','preview','thumbnail','source','attachment','runtime_bundle')),
  storage_provider TEXT NOT NULL DEFAULT 'private_object_storage',
  storage_key TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  byte_size BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  checksum_sha256 TEXT,
  is_public_preview BOOLEAN NOT NULL DEFAULT false,
  scan_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending','clean','blocked','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(storage_provider, storage_key)
),
CREATE INDEX IF NOT EXISTS product_assets_product_idx
  ON product_assets(product_id, product_edition_id, created_at DESC),

-- Versioned definitions for tools/spreadsheets/apps created and edited inside DigiNanba.
-- definition_json describes the supported runtime/tool UI, it is not executable code.
CREATE TABLE IF NOT EXISTS product_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  build_kind TEXT NOT NULL
    CHECK (build_kind IN ('interactive_tool','spreadsheet','template','ebook','course','other')),
  editor_kind TEXT NOT NULL DEFAULT 'native_builder',
  definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','validating','ready','published','rejected','archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, version_number)
),
CREATE INDEX IF NOT EXISTS product_builds_product_status_idx
  ON product_builds(product_id, status, version_number DESC),

-- Snapshot creator attribution at sale time so later listing edits cannot rewrite earnings history.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_minor >= 0),
  ADD COLUMN IF NOT EXISTS payment_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (payment_fee_minor >= 0),
  ADD COLUMN IF NOT EXISTS creator_net_minor BIGINT NOT NULL DEFAULT 0 CHECK (creator_net_minor >= 0),
  ADD COLUMN IF NOT EXISTS currency_code CHAR(3),

UPDATE order_items oi
SET product_id = pe.product_id
FROM product_editions pe
WHERE oi.product_edition_id = pe.id AND oi.product_id IS NULL,

UPDATE order_items oi
SET currency_code = o.currency_code
FROM orders o
WHERE oi.order_id = o.id AND oi.currency_code IS NULL,

CREATE INDEX IF NOT EXISTS order_items_creator_sales_idx
  ON order_items(creator_user_id, order_id)
  WHERE creator_user_id IS NOT NULL,

-- Immutable-style earnings ledger, one row per order item. Rows are created by verified payment handling,
-- not merely by creating a pending checkout.
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  currency_code CHAR(3) NOT NULL,
  gross_amount_minor BIGINT NOT NULL CHECK (gross_amount_minor >= 0),
  tax_withheld_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_withheld_minor >= 0),
  platform_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_minor >= 0),
  payment_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (payment_fee_minor >= 0),
  adjustment_minor BIGINT NOT NULL DEFAULT 0,
  net_amount_minor BIGINT NOT NULL CHECK (net_amount_minor >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','available','on_hold','paid','reversed')),
  available_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
),
CREATE INDEX IF NOT EXISTS creator_earnings_creator_status_created_idx
  ON creator_earnings(creator_user_id, status, created_at DESC),
CREATE INDEX IF NOT EXISTS creator_earnings_order_idx
  ON creator_earnings(order_id),

CREATE TABLE IF NOT EXISTS creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_payout_id TEXT,
  currency_code CHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','paid','failed','cancelled','reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_payout_id)
),
CREATE INDEX IF NOT EXISTS creator_payouts_creator_status_created_idx
  ON creator_payouts(creator_user_id, status, created_at DESC),

CREATE TABLE IF NOT EXISTS creator_payout_items (
  payout_id UUID NOT NULL REFERENCES creator_payouts(id) ON DELETE RESTRICT,
  earning_id UUID NOT NULL REFERENCES creator_earnings(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  PRIMARY KEY(payout_id, earning_id),
  UNIQUE(earning_id)
),

COMMIT,
