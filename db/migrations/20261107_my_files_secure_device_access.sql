-- DigiNanba My Files: private cloud-file metadata and trusted-device recovery foundation.
-- Additive only. Actual object bytes must live in private object storage, never in PostgreSQL.
CREATE TABLE IF NOT EXISTS my_files_storage_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  storage_limit_bytes BIGINT NOT NULL CHECK (storage_limit_bytes > 0),
  price_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month','year','free')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS my_files_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES my_files_storage_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','cancelled','expired')),
  payment_provider TEXT,
  payment_reference TEXT,
  period_starts_at TIMESTAMPTZ,
  period_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS my_files_subscriptions_user_idx ON my_files_subscriptions(user_id,status,period_ends_at DESC);

CREATE TABLE IF NOT EXISTS my_files_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES my_files_folders(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL CHECK (length(trim(folder_name)) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,parent_folder_id,folder_name)
);
CREATE INDEX IF NOT EXISTS my_files_folders_user_idx ON my_files_folders(user_id,parent_folder_id);

CREATE TABLE IF NOT EXISTS my_files_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES my_files_folders(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL UNIQUE,
  original_file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 TEXT,
  encryption_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','quarantined','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS my_files_objects_user_idx ON my_files_objects(user_id,folder_id,status,created_at DESC);

-- Device trust is separate from Auth.js login sessions. A successful account login alone
-- must never insert a trusted device or grant access to My Files.
CREATE TABLE IF NOT EXISTS my_files_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT NOT NULL,
  browser_family TEXT,
  operating_system TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trusted_at TIMESTAMPTZ,
  trust_method TEXT CHECK (trust_method IN ('existing_device_approval','recovery_review','initial_identity_review')),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS my_files_trusted_devices_user_idx ON my_files_trusted_devices(user_id,revoked_at,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS my_files_device_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_device_token_hash TEXT NOT NULL,
  requested_device_label TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('add_device','lost_device_recovery','initial_enrollment')),
  approval_device_id UUID REFERENCES my_files_trusted_devices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','cancelled','awaiting_payment')),
  identity_verification_status TEXT NOT NULL DEFAULT 'not_required' CHECK (identity_verification_status IN ('not_required','pending','verified','rejected')),
  phone_verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (phone_verification_status IN ('pending','verified','rejected')),
  purchase_bill_object_key TEXT,
  identity_document_object_key TEXT,
  complaint_document_object_key TEXT,
  recovery_fee_amount NUMERIC(12,2),
  recovery_fee_currency CHAR(3),
  payment_status TEXT NOT NULL DEFAULT 'not_required' CHECK (payment_status IN ('not_required','pending','paid','failed','refunded')),
  payment_reference TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS my_files_access_requests_user_idx ON my_files_device_access_requests(user_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS my_files_device_access_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES my_files_trusted_devices(id) ON DELETE SET NULL,
  request_id UUID REFERENCES my_files_device_access_requests(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('login_blocked','request_created','approval_sent','request_approved','request_rejected','recovery_payment_confirmed','device_revoked','file_access_granted','file_access_denied')),
  event_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS my_files_access_events_user_idx ON my_files_device_access_events(user_id,occurred_at DESC);

-- Seed only a free starter plan. Paid pricing and activation remain an explicit business decision.
INSERT INTO my_files_storage_plans(plan_code,plan_name,storage_limit_bytes,price_amount,currency,billing_interval,is_active)
VALUES ('starter-1gb','Starter - 1 GB',1073741824,0,'INR','free',false)
ON CONFLICT(plan_code) DO NOTHING;
