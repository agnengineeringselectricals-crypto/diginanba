-- DigiNanba default operating teams for all departments.
-- Compatible with schemas where admin_teams has no status column.
-- Safe to rerun: existing department/team pairs are skipped.
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
) AS seed(department_code, team_name, description)
  ON seed.department_code = d.code
WHERE NOT EXISTS (
  SELECT 1
  FROM admin_teams existing
  WHERE existing.department_id = d.id
    AND existing.name = seed.team_name
);

-- No fake employee accounts or memberships are created. Assign real users separately.
