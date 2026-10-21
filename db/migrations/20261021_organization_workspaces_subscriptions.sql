-- DigiNanba organization workspaces and recurring subscription tracking.
-- Subscription checkout is feature-gated and requires configured Razorpay plan IDs.
BEGIN;
CREATE TABLE IF NOT EXISTS organization_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
 slug TEXT NOT NULL UNIQUE,
 owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 billing_country_code CHAR(2) NOT NULL DEFAULT 'IN',
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_memberships (
 organization_id UUID NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','billing')),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','removed')),
 invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS organization_memberships_user_status_idx ON organization_memberships(user_id,status);
CREATE TABLE IF NOT EXISTS organization_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL UNIQUE REFERENCES organization_accounts(id) ON DELETE CASCADE,
 plan_code TEXT NOT NULL CHECK (plan_code IN ('org_monthly','org_six_month','org_annual')),
 billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly','six_monthly','annual')),
 provider TEXT NOT NULL DEFAULT 'razorpay',
 provider_plan_id TEXT NOT NULL,
 provider_subscription_id TEXT UNIQUE,
 checkout_url TEXT,
 status TEXT NOT NULL DEFAULT 'pending_checkout'
   CHECK (status IN ('pending_checkout','created','authenticated','active','pending','halted','paused','cancelled','completed','expired','failed')),
 currency_code CHAR(3) NOT NULL DEFAULT 'INR',
 amount_minor BIGINT CHECK (amount_minor IS NULL OR amount_minor >= 0),
 current_period_start TIMESTAMPTZ,
 current_period_end TIMESTAMPTZ,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
 last_provider_event_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_subscriptions_status_idx ON organization_subscriptions(status,updated_at DESC);
COMMIT;
