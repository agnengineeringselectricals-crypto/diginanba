-- DigiNanba six-pillar local marketplace foundation.
-- Additive only: preserves the existing digital-products marketplace and data.

CREATE TABLE IF NOT EXISTS marketplace_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL CHECK (business_type IN ('shop','service','professional','healthcare')),
  description TEXT,
  phone TEXT,
  email TEXT,
  website_url TEXT,
  country_code CHAR(2) NOT NULL,
  region TEXT,
  district TEXT,
  city TEXT,
  locality TEXT,
  postal_code TEXT,
  address_line TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','in_review','verified','rejected','suspended')),
  listing_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (listing_status IN ('draft','pending_review','published','paused','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_businesses_type_location_idx
  ON marketplace_businesses(business_type,country_code,region,district,city,postal_code);
CREATE INDEX IF NOT EXISTS marketplace_businesses_owner_idx
  ON marketplace_businesses(owner_user_id);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES marketplace_businesses(id) ON DELETE CASCADE,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('physical_product','service','professional_service','healthcare_service')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  price_amount NUMERIC(14,2),
  currency CHAR(3),
  price_unit TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available','limited','unavailable','by_quotation')),
  delivery_or_service_area JSONB NOT NULL DEFAULT '{}'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  listing_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (listing_status IN ('draft','pending_review','published','paused','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_listings_business_idx ON marketplace_listings(business_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_category_status_idx ON marketplace_listings(category,listing_status);

CREATE TABLE IF NOT EXISTS marketplace_service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id),
  customer_user_id UUID NOT NULL REFERENCES users(id),
  provider_user_id UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ,
  service_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_notes TEXT,
  quoted_amount NUMERIC(14,2),
  currency CHAR(3),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','quoted','accepted','scheduled','completed','cancelled','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_bookings_customer_idx ON marketplace_service_bookings(customer_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_bookings_provider_idx ON marketplace_service_bookings(provider_user_id,status);

-- Healthcare is deliberately separate from ordinary professional listings.
CREATE TABLE IF NOT EXISTS healthcare_provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES marketplace_businesses(id) ON DELETE SET NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('doctor','dentist','hospital','clinic','diagnostic_lab','pharmacy','other_healthcare')),
  display_name TEXT NOT NULL,
  specialty TEXT,
  qualifications TEXT[] NOT NULL DEFAULT '{}',
  registration_authority TEXT,
  registration_number_encrypted TEXT,
  registration_verified_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','in_review','verified','rejected','suspended')),
  consultation_modes TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT '{}',
  country_code CHAR(2) NOT NULL,
  region TEXT,
  district TEXT,
  city TEXT,
  locality TEXT,
  postal_code TEXT,
  clinic_address TEXT,
  public_phone TEXT,
  appointment_enabled BOOLEAN NOT NULL DEFAULT false,
  profile_visibility TEXT NOT NULL DEFAULT 'hidden'
    CHECK (profile_visibility IN ('hidden','public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS healthcare_provider_search_idx
  ON healthcare_provider_profiles(provider_type,country_code,region,district,city,specialty);
CREATE INDEX IF NOT EXISTS healthcare_provider_user_idx ON healthcare_provider_profiles(user_id);

CREATE TABLE IF NOT EXISTS healthcare_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID NOT NULL REFERENCES healthcare_provider_profiles(id),
  patient_user_id UUID NOT NULL REFERENCES users(id),
  appointment_at TIMESTAMPTZ,
  appointment_mode TEXT NOT NULL CHECK (appointment_mode IN ('in_person','teleconsultation')),
  patient_note TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','confirmed','completed','cancelled','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS healthcare_appointments_provider_idx ON healthcare_appointments(provider_profile_id,appointment_at);
CREATE INDEX IF NOT EXISTS healthcare_appointments_patient_idx ON healthcare_appointments(patient_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  headline TEXT,
  summary TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_years NUMERIC(4,1),
  work_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_roles TEXT[] NOT NULL DEFAULT '{}',
  employment_types TEXT[] NOT NULL DEFAULT '{}',
  expected_salary_min NUMERIC(14,2),
  expected_salary_max NUMERIC(14,2),
  salary_currency CHAR(3),
  country_code CHAR(2),
  region TEXT,
  district TEXT,
  city TEXT,
  preferred_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  resume_object_key TEXT,
  profile_visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (profile_visibility IN ('private','searchable','paused')),
  contact_unlock_enabled BOOLEAN NOT NULL DEFAULT false,
  consent_updated_at TIMESTAMPTZ,
  profile_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (profile_status IN ('draft','active','paused','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_profiles_search_idx
  ON candidate_profiles(country_code,region,district,city,experience_years)
  WHERE profile_status='active' AND profile_visibility='searchable';
CREATE INDEX IF NOT EXISTS candidate_profiles_skills_idx ON candidate_profiles USING GIN(skills);

CREATE TABLE IF NOT EXISTS employer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  registration_identifier TEXT,
  website_url TEXT,
  contact_email TEXT,
  country_code CHAR(2),
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','in_review','verified','rejected','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id,company_name)
);
CREATE INDEX IF NOT EXISTS employer_accounts_owner_idx ON employer_accounts(owner_user_id);

CREATE TABLE IF NOT EXISTS candidate_contact_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('contact_view','resume_download')),
  fee_amount NUMERIC(14,2) NOT NULL CHECK (fee_amount >= 0),
  currency CHAR(3) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_reference TEXT,
  candidate_consent_at TIMESTAMPTZ NOT NULL,
  access_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_access_employer_idx ON candidate_contact_access(employer_account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS candidate_access_candidate_idx ON candidate_contact_access(candidate_profile_id,created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_profile_consent_events (
  id BIGSERIAL PRIMARY KEY,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('searchable_profile','contact_unlock','resume_download')),
  enabled BOOLEAN NOT NULL,
  policy_version TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_consent_profile_time_idx
  ON candidate_profile_consent_events(candidate_profile_id,occurred_at DESC);
