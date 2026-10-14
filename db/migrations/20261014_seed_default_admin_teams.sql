-- DigiNanba default operating teams for all active departments.
-- Safe to run repeatedly; creates teams only when the same department/name pair is absent.
INSERT INTO admin_teams (department_id, name, description)
SELECT d.id, seed.team_name, seed.description
FROM admin_departments d
JOIN (VALUES
  ('accounts-security','Access & Account Support','Account access requests, role review and account recovery coordination'),
  ('accounts-security','Security & Compliance','Security reviews, policy checks and compliance follow-up'),
  ('customer-care','Customer Support','General customer questions and help requests'),
  ('customer-care','Complaints & Escalations','Complaint handling, complex cases and service-quality escalations'),
  ('products-catalog','Catalog Operations','Listing quality, category mapping and product metadata'),
  ('products-catalog','Product Review & Publishing','Content checks, quality review and publishing readiness'),
  ('users-creators','User Operations','Account support, onboarding and marketplace community operations'),
  ('users-creators','Creator Success','Creator onboarding, guidance and creator-quality review'),
  ('ai-product-factory','Demand Research','Market demand research and opportunity prioritization'),
  ('ai-product-factory','Product Generation & QA','Digital product production, validation and quality review'),
  ('ai-product-factory','Localization & Release','Localization review and product release coordination'),
  ('finance-payments','Orders & Reconciliation','Order monitoring, payment reconciliation and exception tracking'),
  ('finance-payments','Settlements & Reporting','Settlement reporting and financial controls'),
  ('marketing-growth','SEO & Content','Search optimization, editorial planning and organic growth'),
  ('marketing-growth','Campaigns & Partnerships','Campaign operations, partnerships and acquisition'),
  ('localization-markets','Language Localization','Translation workflows and language quality checks'),
  ('localization-markets','Country & Currency Operations','Market readiness, country settings and currency configuration')
) AS seed(department_code, team_name, description) ON seed.department_code = d.code
WHERE COALESCE(to_jsonb(d)->>'status','active') = 'active'
ON CONFLICT (department_id, name) DO NOTHING;

-- This migration intentionally does not create fake employee accounts or assign
-- real users to leadership/staff roles. Assign memberships after real users exist.
