-- DigiNanba owner-scoped customer CRM and consent-based messaging.
-- Additive schema. Apply to the six-pillar test branch first.
-- Customer contact values are stored encrypted by the application; lookup hashes are
-- keyed HMACs generated server-side (never plain SHA hashes of phone numbers).

CREATE TABLE IF NOT EXISTS marketplace_customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_key TEXT NOT NULL,
  category_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  workspace_ref UUID,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_customer_accounts_workspace_key_check
    CHECK (workspace_key ~ '^[a-z0-9][a-z0-9:_-]{1,159}$'),
  CONSTRAINT marketplace_customer_accounts_category_key_check
    CHECK (category_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT marketplace_customer_accounts_display_name_check
    CHECK (char_length(trim(display_name)) BETWEEN 2 AND 160),
  CONSTRAINT marketplace_customer_accounts_owner_workspace_uq
    UNIQUE (owner_user_id, workspace_key),
  CONSTRAINT marketplace_customer_accounts_id_owner_uq
    UNIQUE (id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS marketplace_customer_accounts_owner_status_idx
  ON marketplace_customer_accounts(owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_customer_accounts_category_idx
  ON marketplace_customer_accounts(category_key, status);

CREATE TABLE IF NOT EXISTS marketplace_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  full_name TEXT,
  phone_e164_encrypted TEXT,
  phone_lookup_hash CHAR(64),
  phone_last4 CHAR(4),
  phone_country_code CHAR(2),
  email_encrypted TEXT,
  email_lookup_hash CHAR(64),
  notes_encrypted TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','booking','purchase','inquiry','referral','import','other')),
  source_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','do_not_contact','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_customers_account_owner_fk
    FOREIGN KEY (account_id, owner_user_id)
    REFERENCES marketplace_customer_accounts(id, owner_user_id) ON DELETE CASCADE,
  CONSTRAINT marketplace_customers_contact_check
    CHECK (
      phone_e164_encrypted IS NOT NULL OR email_encrypted IS NOT NULL
      OR (full_name IS NOT NULL AND char_length(trim(full_name)) > 0)
    ),
  CONSTRAINT marketplace_customers_phone_hash_check
    CHECK (phone_lookup_hash IS NULL OR phone_lookup_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT marketplace_customers_email_hash_check
    CHECK (email_lookup_hash IS NULL OR email_lookup_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT marketplace_customers_id_account_owner_uq
    UNIQUE (id, account_id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS marketplace_customers_account_created_idx
  ON marketplace_customers(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_customers_account_status_idx
  ON marketplace_customers(account_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_customers_phone_lookup_idx
  ON marketplace_customers(account_id, phone_lookup_hash)
  WHERE phone_lookup_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_customers_email_lookup_idx
  ON marketplace_customers(account_id, email_lookup_hash)
  WHERE email_lookup_hash IS NOT NULL;

-- Current consent state is the send-time gate. Existing/imported contacts default to
-- no consent because no row means no permission to send promotional messages.
CREATE TABLE IF NOT EXISTS marketplace_customer_channel_consents (
  customer_id UUID NOT NULL,
  account_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email','voice')),
  purpose TEXT NOT NULL CHECK (purpose IN ('marketing','service_updates','transactional')),
  consent_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (consent_status IN ('unknown','granted','revoked')),
  consent_source TEXT,
  disclosure_version TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, channel, purpose),
  CONSTRAINT marketplace_customer_channel_consents_customer_fk
    FOREIGN KEY (customer_id, account_id, owner_user_id)
    REFERENCES marketplace_customers(id, account_id, owner_user_id) ON DELETE CASCADE,
  CONSTRAINT marketplace_customer_channel_consents_dates_check
    CHECK (
      (consent_status <> 'granted' OR granted_at IS NOT NULL)
      AND (consent_status <> 'revoked' OR revoked_at IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS marketplace_customer_channel_consents_send_gate_idx
  ON marketplace_customer_channel_consents(account_id, channel, purpose, consent_status, customer_id);

-- Append-only history of opt-in and opt-out actions for auditability.
CREATE TABLE IF NOT EXISTS marketplace_customer_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  account_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email','voice')),
  purpose TEXT NOT NULL CHECK (purpose IN ('marketing','service_updates','transactional')),
  action TEXT NOT NULL CHECK (action IN ('granted','revoked')),
  consent_source TEXT NOT NULL,
  disclosure_version TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_customer_consent_events_customer_fk
    FOREIGN KEY (customer_id, account_id, owner_user_id)
    REFERENCES marketplace_customers(id, account_id, owner_user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS marketplace_customer_consent_events_history_idx
  ON marketplace_customer_consent_events(customer_id, channel, purpose, occurred_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_customer_consent_events_owner_idx
  ON marketplace_customer_consent_events(account_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_offer_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp','sms','email')),
  purpose TEXT NOT NULL DEFAULT 'marketing'
    CHECK (purpose IN ('marketing','service_updates','transactional')),
  message_template TEXT NOT NULL,
  discount_type TEXT CHECK (discount_type IS NULL OR discount_type IN ('percentage','fixed_amount','custom')),
  discount_value NUMERIC(12,2),
  currency_code CHAR(3),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','scheduled','queued','sending','paused','completed','cancelled')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_offer_campaigns_account_fk
    FOREIGN KEY (account_id, owner_user_id)
    REFERENCES marketplace_customer_accounts(id, owner_user_id) ON DELETE CASCADE,
  CONSTRAINT marketplace_offer_campaigns_name_check
    CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
  CONSTRAINT marketplace_offer_campaigns_discount_check
    CHECK (discount_value IS NULL OR discount_value >= 0),
  CONSTRAINT marketplace_offer_campaigns_dates_check
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT marketplace_offer_campaigns_id_account_owner_uq
    UNIQUE (id, account_id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS marketplace_offer_campaigns_account_idx
  ON marketplace_offer_campaigns(account_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  account_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sent','delivered','read','failed','skipped_no_consent','skipped_opt_out')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code TEXT,
  queued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_campaign_recipients_campaign_fk
    FOREIGN KEY (campaign_id, account_id, owner_user_id)
    REFERENCES marketplace_offer_campaigns(id, account_id, owner_user_id) ON DELETE CASCADE,
  CONSTRAINT marketplace_campaign_recipients_customer_fk
    FOREIGN KEY (customer_id, account_id, owner_user_id)
    REFERENCES marketplace_customers(id, account_id, owner_user_id) ON DELETE CASCADE,
  CONSTRAINT marketplace_campaign_recipients_campaign_customer_channel_uq
    UNIQUE (campaign_id, customer_id, channel)
);
CREATE INDEX IF NOT EXISTS marketplace_campaign_recipients_queue_idx
  ON marketplace_campaign_recipients(status, created_at)
  WHERE status IN ('pending','queued');
CREATE INDEX IF NOT EXISTS marketplace_campaign_recipients_account_idx
  ON marketplace_campaign_recipients(account_id, campaign_id, status);

CREATE TABLE IF NOT EXISTS marketplace_message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES marketplace_campaign_recipients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_message_events_provider_event_uq
    UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS marketplace_message_events_recipient_idx
  ON marketplace_message_events(recipient_id, occurred_at DESC);

COMMENT ON TABLE marketplace_customer_accounts IS
  'One isolated CRM workspace per owner and marketplace workspace/category; usable across all marketplace pillars.';
COMMENT ON TABLE marketplace_customers IS
  'Owner-scoped customer contacts. Phone/email values must be application-encrypted; lookup hashes must be keyed HMACs.';
COMMENT ON TABLE marketplace_customer_channel_consents IS
  'Current channel- and purpose-specific permission state. Missing or unknown consent is never eligible for marketing sends.';
COMMENT ON TABLE marketplace_customer_consent_events IS
  'Audit history of customer opt-in and opt-out events.';
COMMENT ON TABLE marketplace_offer_campaigns IS
  'Owner-created offer campaigns. Draft creation does not authorize sending; sending requires an approved campaign and eligible consent.';
COMMENT ON TABLE marketplace_campaign_recipients IS
  'Campaign delivery queue and per-customer status; recipient eligibility must be rechecked immediately before dispatch.';
COMMENT ON TABLE marketplace_message_events IS
  'Provider webhook events for WhatsApp/SMS/email delivery tracking.';


-- Database-level send gate: recipients cannot be queued or marked sent unless
-- the campaign has an explicit approval timestamp and the customer has active,
-- purpose-specific consent for the exact channel.
CREATE OR REPLACE FUNCTION enforce_marketplace_campaign_recipient_send_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_channel TEXT;
  v_campaign_purpose TEXT;
  v_campaign_status TEXT;
  v_campaign_approved_at TIMESTAMPTZ;
  v_customer_status TEXT;
  v_consent_status TEXT;
BEGIN
  IF NEW.status IN ('queued','sent') THEN
    SELECT channel, purpose, status, approved_at
      INTO v_campaign_channel, v_campaign_purpose, v_campaign_status, v_campaign_approved_at
    FROM marketplace_offer_campaigns
    WHERE id = NEW.campaign_id
      AND account_id = NEW.account_id
      AND owner_user_id = NEW.owner_user_id;

    IF NOT FOUND
       OR v_campaign_channel <> NEW.channel
       OR v_campaign_status NOT IN ('approved','scheduled','queued','sending')
       OR v_campaign_approved_at IS NULL THEN
      RAISE EXCEPTION 'Campaign must be explicitly approved and active before sending';
    END IF;

    SELECT status INTO v_customer_status
    FROM marketplace_customers
    WHERE id = NEW.customer_id
      AND account_id = NEW.account_id
      AND owner_user_id = NEW.owner_user_id;

    IF v_customer_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Customer is not eligible to receive messages';
    END IF;

    SELECT consent_status INTO v_consent_status
    FROM marketplace_customer_channel_consents
    WHERE customer_id = NEW.customer_id
      AND account_id = NEW.account_id
      AND owner_user_id = NEW.owner_user_id
      AND channel = NEW.channel
      AND purpose = v_campaign_purpose;

    IF v_consent_status IS DISTINCT FROM 'granted' THEN
      RAISE EXCEPTION 'Current customer consent is required before queueing or sending';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_campaign_recipient_send_gate
  ON marketplace_campaign_recipients;
CREATE TRIGGER marketplace_campaign_recipient_send_gate
  BEFORE INSERT OR UPDATE OF status, campaign_id, customer_id, channel, account_id, owner_user_id
  ON marketplace_campaign_recipients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_marketplace_campaign_recipient_send_gate();


-- Campaigns cannot enter an approved or dispatchable state without a recorded approval.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_offer_campaigns_approval_required_check'
      AND conrelid = 'public.marketplace_offer_campaigns'::regclass
  ) THEN
    ALTER TABLE marketplace_offer_campaigns
      ADD CONSTRAINT marketplace_offer_campaigns_approval_required_check
      CHECK (
        status NOT IN ('approved','scheduled','queued','sending')
        OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
      );
  END IF;
END;
$$;

-- Keep a consent audit row whenever the current permission changes to granted/revoked.
CREATE OR REPLACE FUNCTION log_marketplace_customer_consent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.consent_status IN ('granted','revoked')
     AND (TG_OP = 'INSERT' OR OLD.consent_status IS DISTINCT FROM NEW.consent_status) THEN
    IF NEW.consent_source IS NULL OR length(trim(NEW.consent_source)) = 0 THEN
      RAISE EXCEPTION 'A consent source is required when granting or revoking consent';
    END IF;

    INSERT INTO marketplace_customer_consent_events(
      customer_id, account_id, owner_user_id, channel, purpose,
      action, consent_source, disclosure_version, evidence, occurred_at
    ) VALUES (
      NEW.customer_id, NEW.account_id, NEW.owner_user_id, NEW.channel, NEW.purpose,
      NEW.consent_status, NEW.consent_source, NEW.disclosure_version, NEW.evidence, now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_customer_consent_audit
  ON marketplace_customer_channel_consents;
CREATE TRIGGER marketplace_customer_consent_audit
  AFTER INSERT OR UPDATE OF consent_status, consent_source, disclosure_version, evidence
  ON marketplace_customer_channel_consents
  FOR EACH ROW
  EXECUTE FUNCTION log_marketplace_customer_consent_change();
