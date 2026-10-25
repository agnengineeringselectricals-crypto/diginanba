CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code CHAR(2) NOT NULL DEFAULT 'IN';

CREATE OR REPLACE FUNCTION diginanba_base36_id(p_country_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  suffix TEXT;
  i INTEGER;
BEGIN
  IF p_country_code IS NULL OR p_country_code !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'country_code must be a two-letter uppercase ISO country code';
  END IF;
  FOR i IN 1..100 LOOP
    suffix := '';
    WHILE length(suffix) < 6 LOOP
      suffix := suffix || substr(alphabet, (get_byte(gen_random_bytes(1), 0) % 36) + 1, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM users WHERE public_id = p_country_code || '-' || suffix) THEN
      RETURN p_country_code || '-' || suffix;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not allocate unique DigiNanba user ID after retries';
END;
$$;

CREATE OR REPLACE FUNCTION diginanba_assign_user_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.country_code := upper(NEW.country_code);
  IF NEW.public_id IS NULL OR NEW.public_id LIKE 'DN-C-%' OR NEW.public_id !~ '^[A-Z]{2}-[0-9A-Z]{6}$' THEN
    NEW.public_id := diginanba_base36_id(NEW.country_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_assign_public_id_trigger ON users;
CREATE TRIGGER users_assign_public_id_trigger
BEFORE INSERT OR UPDATE OF country_code ON users
FOR EACH ROW EXECUTE FUNCTION diginanba_assign_user_public_id();

UPDATE users SET public_id = diginanba_base36_id(upper(country_code))
WHERE public_id IS NULL OR public_id LIKE 'DN-C-%' OR public_id !~ '^[A-Z]{2}-[0-9A-Z]{6}$';

CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_uidx ON users(public_id);
CREATE INDEX IF NOT EXISTS users_country_code_idx ON users(country_code);

CREATE TABLE IF NOT EXISTS user_login_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  country_code CHAR(2),
  region TEXT,
  city TEXT,
  user_agent TEXT,
  session_token_hash TEXT,
  login_method TEXT NOT NULL DEFAULT 'credentials',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_login_events_user_time_idx ON user_login_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS user_login_events_ip_time_idx ON user_login_events(ip_address, occurred_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS user_security_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  two_step_enabled BOOLEAN NOT NULL DEFAULT false,
  primary_email_verified_at TIMESTAMPTZ,
  primary_phone_verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
