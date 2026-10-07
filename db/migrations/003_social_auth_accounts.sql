CREATE TABLE IF NOT EXISTS user_auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_account_id),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS user_auth_accounts_user_id_idx
  ON user_auth_accounts(user_id);
