-- DigiNanba: explicit account types and subscriber records for trustworthy admin analytics.
-- Run once in Neon SQL Editor. Existing users default to normal; no account types are guessed.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_account_type_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('normal', 'creator'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_account_type_created_idx
  ON users(account_type, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_status_created_idx
  ON subscriptions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx
  ON subscriptions(user_id, status);
