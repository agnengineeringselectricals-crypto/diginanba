-- Compatibility repair for account preferences and account security activity.
-- The original account ID migration generated 9-character IDs (CC-XXXXXX)
-- while an older production column was varchar(8). Widen it before ID allocation.
ALTER TABLE users ALTER COLUMN public_id TYPE TEXT;

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
CREATE INDEX IF NOT EXISTS user_login_events_user_time_idx
  ON user_login_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS user_login_events_ip_time_idx
  ON user_login_events(ip_address, occurred_at DESC);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_marketing_consent_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('promotion_emails', 'referral_updates', 'creator_newsletter')),
  enabled BOOLEAN NOT NULL,
  source TEXT NOT NULL DEFAULT 'account_settings',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_marketing_consent_user_time_idx
  ON user_marketing_consent_events(user_id, occurred_at DESC);
