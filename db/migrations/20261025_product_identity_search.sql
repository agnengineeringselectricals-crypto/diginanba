-- Stable public product and creator identities, plus creator-aware catalog search.
-- Safe to apply repeatedly; preserves internal UUID primary keys and existing product URLs.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS product_public_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS creator_public_id_seq START WITH 1;

ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;

ALTER TABLE users ALTER COLUMN public_id SET DEFAULT ('DN-C-' || lpad(nextval('creator_public_id_seq')::text, 6, '0'));
ALTER TABLE products ALTER COLUMN public_id SET DEFAULT ('DN-P-' || lpad(nextval('product_public_id_seq')::text, 6, '0'));

CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_uidx ON users(public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_public_id_uidx ON products(public_id) WHERE public_id IS NOT NULL;

-- The platform itself is the accountable creator for DigiNanba AI-factory products.
INSERT INTO users (email, display_name, status)
VALUES ('platform@diginanba.com', 'DigiNanba', 'active')
ON CONFLICT (email) DO UPDATE SET display_name = 'DigiNanba', updated_at = now();

UPDATE users
SET public_id = 'DN-C-000001'
WHERE email = 'platform@diginanba.com'
  AND (public_id IS NULL OR public_id <> 'DN-C-000001');

-- Backfill all other users with unique stable creator IDs.
UPDATE users
SET public_id = 'DN-C-' || lpad(nextval('creator_public_id_seq')::text, 6, '0')
WHERE public_id IS NULL;

-- Allocate predictable IDs to the existing catalog in creation/slug order, without changing UUIDs.
WITH missing AS (
  SELECT id, row_number() OVER (ORDER BY created_at, slug) AS rn
  FROM products WHERE public_id IS NULL
)
UPDATE products p
SET public_id = 'DN-P-' || lpad(nextval('product_public_id_seq')::text, 6, '0')
FROM missing m
WHERE p.id = m.id;

UPDATE products
SET short_description = left(regexp_replace(COALESCE(NULLIF(description, ''), title), '\\s+', ' ', 'g'), 240)
WHERE short_description IS NULL OR btrim(short_description) = '';

ALTER TABLE products ALTER COLUMN short_description SET DEFAULT '';
ALTER TABLE products ALTER COLUMN short_description SET NOT NULL;

-- Associate platform-owned legacy/dummy products with DigiNanba's creator identity.
UPDATE products
SET creator_user_id = (SELECT id FROM users WHERE email = 'platform@diginanba.com')
WHERE creator_user_id IS NULL AND owner_type = 'platform';

CREATE INDEX IF NOT EXISTS products_public_id_search_idx ON products(public_id);
CREATE INDEX IF NOT EXISTS products_short_description_search_idx ON products USING gin (to_tsvector('simple', short_description));
CREATE INDEX IF NOT EXISTS users_display_name_search_idx ON users USING gin (to_tsvector('simple', COALESCE(display_name, '')));

COMMIT;
