-- DigiNanba department hierarchy and granular RBAC foundation.
-- Additive only: preserves existing users, marketplace data and factory jobs.
BEGIN;

CREATE TABLE IF NOT EXISTS admin_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES admin_departments(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  team_leader_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, name)
);

CREATE TABLE IF NOT EXISTS admin_team_members (
  team_id UUID NOT NULL REFERENCES admin_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role TEXT NOT NULL DEFAULT 'staff'
    CHECK (membership_role IN ('team_leader', 'staff')),
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS admin_permission_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_departments (code, name, description) VALUES
('accounts-security', 'Accounts & Security', 'Administrator accounts, role assignments and security reviews.'),
('customer-care', 'Customer Care', 'Customer support, complaints and escalations.'),
('products-catalog', 'Products & Catalog', 'Product quality, categories, pricing and publishing reviews.'),
('users-creators', 'Users & Creators', 'Account reviews, creator onboarding and marketplace trust.'),
('ai-factory', 'AI Product Factory', 'Research jobs, product drafts, localization and quality reviews.'),
('finance-payments', 'Finance & Payments', 'Orders, refunds, settlements, commissions and reconciliation.'),
('marketing-growth', 'Marketing & Growth', 'Campaigns, SEO, promotions and performance reporting.'),
('localization-markets', 'Localization & Markets', 'Market configuration, language coverage and regional catalogs.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (name, description) VALUES
('Admin Accounts & Security', 'Manage administrator access requests and security operations within delegated scope.'),
('Admin Customer Care', 'Manage customer support operations.'),
('Admin Products & Catalog', 'Manage catalog operations and product review workflows.'),
('Admin Users & Creators', 'Manage user and creator review workflows.'),
('Admin AI Factory', 'Manage AI Product Factory jobs and draft review workflows.'),
('Admin Finance & Payments', 'Manage finance operations within explicitly granted permissions.'),
('Admin Marketing & Growth', 'Manage marketing and growth operations.'),
('Admin Localization & Markets', 'Manage localization and regional market operations.'),
('Customer Care Team Leader', 'Lead a customer care team.'),
('Customer Care Staff', 'Handle assigned customer care work.'),
('Products Team Leader', 'Lead a products and catalog team.'),
('Products Staff', 'Handle assigned product and catalog work.'),
('Users & Creators Team Leader', 'Lead a users and creators team.'),
('Users & Creators Staff', 'Handle assigned users and creators work.'),
('AI Factory Team Leader', 'Lead AI Factory operations and review workload.'),
('AI Factory Staff', 'Handle assigned AI Factory work.'),
('Finance Team Leader', 'Lead a finance operations team.'),
('Finance Staff', 'Handle permitted finance operations.'),
('Marketing Team Leader', 'Lead a marketing and growth team.'),
('Marketing Staff', 'Handle assigned marketing work.'),
('Localization Team Leader', 'Lead localization and market operations.'),
('Localization Staff', 'Handle assigned localization work.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (key, description) VALUES
('admin.dashboard.view', 'View the private administration dashboard.'),
('admin.departments.view', 'View departments and team structures.'),
('admin.departments.manage', 'Create and manage departments and teams within authorized scope.'),
('admin.staff.view', 'View staff assignments within authorized scope.'),
('admin.staff.invite', 'Invite staff into authorized departments.'),
('admin.staff.assign_role', 'Assign roles the actor is authorized to delegate.'),
('admin.audit.view', 'View administrative audit records.'),
('support.tickets.view', 'View permitted customer support tickets.'),
('support.tickets.manage', 'Manage assigned support tickets.'),
('catalog.products.view', 'View product catalog records.'),
('catalog.products.edit', 'Edit product catalog records.'),
('catalog.products.approve', 'Approve product changes within authorized scope.'),
('catalog.products.publish', 'Publish approved products.'),
('users.creators.view', 'View permitted user and creator records.'),
('users.creators.review', 'Review user and creator onboarding or reports.'),
('ai_factory.jobs.view', 'View AI Factory jobs.'),
('ai_factory.jobs.manage', 'Queue and manage AI Factory jobs.'),
('ai_factory.drafts.review', 'Review AI-generated product drafts.'),
('finance.records.view', 'View permitted finance records.'),
('finance.refunds.approve', 'Approve refunds within assigned limits.'),
('finance.settlements.execute', 'Execute settlements with required approvals.'),
('marketing.campaigns.manage', 'Manage marketing campaigns.'),
('markets.localization.manage', 'Manage localization and regional market configuration.')
ON CONFLICT (key) DO NOTHING;

-- Department administrators receive only their department's basic operational permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON
  (r.name = 'Admin Accounts & Security' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','admin.staff.invite','admin.staff.assign_role','admin.audit.view'))
  OR (r.name = 'Admin Customer Care' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','support.tickets.view','support.tickets.manage'))
  OR (r.name = 'Admin Products & Catalog' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','catalog.products.view','catalog.products.edit','catalog.products.approve','catalog.products.publish'))
  OR (r.name = 'Admin Users & Creators' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','users.creators.view','users.creators.review'))
  OR (r.name = 'Admin AI Factory' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','ai_factory.jobs.view','ai_factory.jobs.manage','ai_factory.drafts.review'))
  OR (r.name = 'Admin Finance & Payments' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','finance.records.view','finance.refunds.approve'))
  OR (r.name = 'Admin Marketing & Growth' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','marketing.campaigns.manage'))
  OR (r.name = 'Admin Localization & Markets' AND p.key IN ('admin.dashboard.view','admin.departments.view','admin.staff.view','markets.localization.manage'))
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
ON CONFLICT DO NOTHING;

COMMIT;
