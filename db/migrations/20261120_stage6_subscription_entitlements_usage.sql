-- Stage 6: subscription plan entitlements, optional module activation and usage metering.
-- Additive only. Does not enable live billing, set prices, or create customer activity.
BEGIN;
CREATE TABLE IF NOT EXISTS pm_plan_module_entitlements (
 plan_code text NOT NULL CHECK(plan_code IN ('org_monthly','org_six_month','org_annual')),
 module_code text NOT NULL REFERENCES pm_module_catalog(module_code) ON DELETE RESTRICT,
 included boolean NOT NULL DEFAULT false, optional_available boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(plan_code,module_code),
 CHECK(NOT(included AND optional_available))
);
CREATE TABLE IF NOT EXISTS pm_plan_usage_limits (
 plan_code text NOT NULL CHECK(plan_code IN ('org_monthly','org_six_month','org_annual')),
 meter_code text NOT NULL,unit text NOT NULL,included_quantity numeric(20,4) NOT NULL DEFAULT 0 CHECK(included_quantity>=0),
 hard_limit numeric(20,4) CHECK(hard_limit IS NULL OR hard_limit>=included_quantity),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(plan_code,meter_code)
);
ALTER TABLE pm_organization_modules ADD COLUMN IF NOT EXISTS enabled_by uuid REFERENCES users(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE pm_usage_events ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS pm_usage_events_org_meter_period_idx ON pm_usage_events(organization_id,meter_code,occurred_at DESC);
CREATE INDEX IF NOT EXISTS pm_usage_events_actor_time_idx ON pm_usage_events(organization_id,actor_user_id,occurred_at DESC);
INSERT INTO pm_plan_module_entitlements(plan_code,module_code,included,optional_available)
SELECT plans.plan_code,c.module_code,c.billing_mode='included',c.billing_mode<>'included'
FROM (VALUES('org_monthly'),('org_six_month'),('org_annual')) AS plans(plan_code) CROSS JOIN pm_module_catalog c
WHERE c.is_active=true ON CONFLICT(plan_code,module_code) DO UPDATE SET included=EXCLUDED.included,optional_available=EXCLUDED.optional_available;
INSERT INTO pm_organization_modules(organization_id,module_code,enabled,enabled_at,configuration)
SELECT o.id,c.module_code,(c.billing_mode='included'),CASE WHEN c.billing_mode='included' THEN now() ELSE NULL END,'{}'::jsonb
FROM organization_accounts o CROSS JOIN pm_module_catalog c WHERE c.is_active=true ON CONFLICT(organization_id,module_code) DO NOTHING;
COMMIT;