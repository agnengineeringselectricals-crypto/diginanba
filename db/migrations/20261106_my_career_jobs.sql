-- Additional recruitment workflow tables for My Career.
CREATE TABLE IF NOT EXISTS marketplace_job_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','temporary','internship')),
  experience_min NUMERIC(4,1),
  experience_max NUMERIC(4,1),
  salary_min NUMERIC(14,2),
  salary_max NUMERIC(14,2),
  salary_currency CHAR(3),
  country_code CHAR(2),
  region TEXT,
  district TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','published','paused','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_job_posts_search_idx
 ON marketplace_job_posts(country_code,region,district,city,status);
CREATE INDEX IF NOT EXISTS marketplace_job_posts_employer_idx
 ON marketplace_job_posts(employer_account_id,created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES marketplace_job_posts(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  cover_note TEXT,
  resume_object_key TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','shortlisted','rejected','withdrawn','hired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_post_id,candidate_profile_id)
);
CREATE INDEX IF NOT EXISTS marketplace_job_applications_candidate_idx
 ON marketplace_job_applications(candidate_profile_id,created_at DESC);
