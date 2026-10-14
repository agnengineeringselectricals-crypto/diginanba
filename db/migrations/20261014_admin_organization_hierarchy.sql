-- DigiNanba organization hierarchy foundation.
-- Safe to run repeatedly in Neon.
CREATE TABLE IF NOT EXISTS admin_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES admin_departments(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, name)
);
CREATE TABLE IF NOT EXISTS admin_staff_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES admin_departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES admin_teams(id) ON DELETE SET NULL,
  role_code TEXT NOT NULL CHECK (role_code IN ('chief_admin','sub_admin','team_leader','staff')),
  reports_to_membership_id UUID REFERENCES admin_staff_memberships(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended','inactive')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reports_to_membership_id IS NULL OR reports_to_membership_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_staff_one_active_membership_per_department_idx
  ON admin_staff_memberships(user_id, department_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('active','invited');
CREATE INDEX IF NOT EXISTS admin_staff_department_role_status_idx
  ON admin_staff_memberships(department_id, role_code, status);
CREATE INDEX IF NOT EXISTS admin_staff_team_role_status_idx
  ON admin_staff_memberships(team_id, role_code, status);
CREATE INDEX IF NOT EXISTS admin_staff_reports_to_idx
  ON admin_staff_memberships(reports_to_membership_id);

INSERT INTO admin_departments(code,name,description) VALUES
 ('accounts-security','Accounts & Security','Account administration, access control, platform security and compliance'),
 ('customer-care','Customer Care','Customer questions, complaints, refunds escalation and service quality'),
 ('products-catalog','Products & Catalog','Digital product quality, categories, listings, pricing and publishing'),
 ('users-creators','Users & Creators','User support, creator onboarding, creator quality and community operations'),
 ('ai-product-factory','AI Product Factory','Demand research, product generation, review and localization workflows'),
 ('finance-payments','Finance & Payments','Orders, payment reconciliation, settlement reporting and finance controls'),
 ('marketing-growth','Marketing & Growth','Acquisition, campaigns, partnerships, SEO and retention'),
 ('localization-markets','Localization & Markets','Country launches, languages, currencies and market-specific readiness')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

-- Add hierarchy role labels to the existing role catalogue; permissions are not granted implicitly.
INSERT INTO roles(name, description) VALUES
 ('Department Admin','Sub-admin for an assigned department only'),
 ('Team Leader','Leads an assigned team and its staff'),
 ('Staff','Performs assigned operational duties only')
ON CONFLICT (name) DO NOTHING;
