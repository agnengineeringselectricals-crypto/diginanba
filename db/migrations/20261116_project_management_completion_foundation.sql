-- DigiNanba PM completion foundation: additive tables for remaining SaaS workflows.
-- Reuses users, organization_accounts, organization_memberships and existing pm_* foundations.
-- No payment collection, subscription activation, or customer data is created by this migration.
BEGIN;

-- Project planning and workforce execution
CREATE TABLE IF NOT EXISTS pm_project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  milestone_code text,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  baseline_date date,
  forecast_date date,
  actual_date date,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','at_risk','completed','on_hold','cancelled')),
  owner_membership_id uuid,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,owner_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_project_milestones_project_idx ON pm_project_milestones(organization_id,project_id,baseline_date);

CREATE TABLE IF NOT EXISTS pm_workforce_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  role_on_project text NOT NULL DEFAULT '',
  planned_start date,
  planned_finish date,
  actual_start date,
  actual_finish date,
  planned_hours numeric(12,2),
  actual_hours numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','released','cancelled')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_workforce_assignments_member_idx ON pm_workforce_assignments(organization_id,membership_id,status);

CREATE TABLE IF NOT EXISTS pm_timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','locked')),
  submitted_at timestamptz,
  approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS pm_timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  timesheet_id uuid NOT NULL,
  project_id uuid NOT NULL,
  task_id uuid,
  work_date date NOT NULL,
  hours numeric(8,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  work_description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,timesheet_id) REFERENCES pm_timesheets(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,task_id) REFERENCES pm_tasks(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_timesheet_entries_project_date_idx ON pm_timesheet_entries(organization_id,project_id,work_date);

-- Procurement detail and receipt tracking
CREATE TABLE IF NOT EXISTS pm_purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  line_number integer NOT NULL,
  material_id uuid,
  description text NOT NULL,
  specification text NOT NULL DEFAULT '',
  unit text NOT NULL,
  ordered_quantity numeric(18,4) NOT NULL CHECK (ordered_quantity > 0),
  received_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_rate numeric(18,4) NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  line_total numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,purchase_order_id,line_number),
  FOREIGN KEY (organization_id,purchase_order_id) REFERENCES pm_purchase_orders(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,material_id) REFERENCES pm_material_catalog(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS pm_goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  receipt_number text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','inspected','accepted','rejected','partially_accepted')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,receipt_number),
  FOREIGN KEY (organization_id,purchase_order_id) REFERENCES pm_purchase_orders(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS pm_goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  purchase_order_item_id uuid NOT NULL,
  received_quantity numeric(18,4) NOT NULL CHECK (received_quantity > 0),
  accepted_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK (accepted_quantity >= 0),
  rejected_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
  remarks text NOT NULL DEFAULT '',
  FOREIGN KEY (organization_id,receipt_id) REFERENCES pm_goods_receipts(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,purchase_order_item_id) REFERENCES pm_purchase_order_items(organization_id,id) ON DELETE RESTRICT
);

-- Quality non-conformance and corrective/preventive actions
CREATE TABLE IF NOT EXISTS pm_quality_nonconformities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  inspection_id uuid,
  nc_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','under_review','corrective_action','verification','closed','rejected')),
  raised_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to_membership_id uuid,
  due_date date,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,nc_number),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,inspection_id) REFERENCES pm_quality_inspections(organization_id,id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id,assigned_to_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS pm_quality_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nonconformity_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('containment','correction','corrective','preventive','verification')),
  description text NOT NULL,
  owner_membership_id uuid,
  due_date date,
  completed_at timestamptz,
  effectiveness_result text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,nonconformity_id) REFERENCES pm_quality_nonconformities(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,owner_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);

-- Finance budgets and cost classification; entries remain draft until explicitly approved/posted.
CREATE TABLE IF NOT EXISTS pm_cost_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  parent_code_id uuid,
  cost_type text NOT NULL DEFAULT 'direct' CHECK (cost_type IN ('direct','indirect','overhead','income')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,code),
  FOREIGN KEY (organization_id,parent_code_id) REFERENCES pm_cost_codes(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS pm_project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  cost_code_id uuid,
  budget_name text NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'INR',
  baseline_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (baseline_amount >= 0),
  revised_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (revised_amount >= 0),
  committed_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (committed_amount >= 0),
  actual_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (actual_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','locked')),
  approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,cost_code_id) REFERENCES pm_cost_codes(organization_id,id) ON DELETE RESTRICT
);

-- Controlled document revisions and reusable approval workflow
CREATE TABLE IF NOT EXISTS pm_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL,
  revision text NOT NULL,
  storage_key text NOT NULL,
  mime_type text,
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  change_summary text NOT NULL DEFAULT '',
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,document_id,revision),
  FOREIGN KEY (organization_id,document_id) REFERENCES pm_documents(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS pm_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  project_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  approval_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','withdrawn')),
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS pm_approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  approval_request_id uuid NOT NULL,
  step_number integer NOT NULL CHECK (step_number > 0),
  approver_membership_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','skipped')),
  decision_note text NOT NULL DEFAULT '',
  decided_at timestamptz,
  UNIQUE (organization_id,approval_request_id,step_number),
  FOREIGN KEY (organization_id,approval_request_id) REFERENCES pm_approval_requests(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,approver_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);

-- External client/supplier portal identities are isolated by organization and are not DigiNanba staff memberships.
CREATE TABLE IF NOT EXISTS pm_external_portal_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  party_type text NOT NULL CHECK (party_type IN ('client','supplier')),
  party_id uuid NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  invitation_token_hash text,
  invitation_expires_at timestamptz,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','revoked')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pm_external_portal_email_party_uq ON pm_external_portal_members(organization_id,party_type,party_id,lower(email));

-- In-app notifications and delivery audit. External delivery remains configuration-gated.
CREATE TABLE IF NOT EXISTS pm_notification_preferences (
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp')),
  event_code text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id,channel,event_code)
);
CREATE TABLE IF NOT EXISTS pm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pm_notifications_inbox_idx ON pm_notifications(organization_id,user_id,created_at DESC) WHERE read_at IS NULL;
CREATE TABLE IF NOT EXISTS pm_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES pm_notifications(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  provider text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','suppressed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Meter pricing catalogue for future usage billing; no invoice or payment is initiated.
CREATE TABLE IF NOT EXISTS pm_usage_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL REFERENCES pm_module_catalog(module_code) ON DELETE RESTRICT,
  meter_code text NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'INR',
  unit_price numeric(18,6) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  included_quantity numeric(20,4) NOT NULL DEFAULT 0 CHECK (included_quantity >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  UNIQUE (module_code,meter_code,currency_code,effective_from)
);
CREATE TABLE IF NOT EXISTS pm_usage_period_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  meter_code text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  measured_quantity numeric(20,4) NOT NULL DEFAULT 0 CHECK (measured_quantity >= 0),
  included_quantity numeric(20,4) NOT NULL DEFAULT 0 CHECK (included_quantity >= 0),
  billable_quantity numeric(20,4) NOT NULL DEFAULT 0 CHECK (billable_quantity >= 0),
  currency_code char(3) NOT NULL DEFAULT 'INR',
  estimated_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (estimated_amount >= 0),
  status text NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated','reviewed','invoiced','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (organization_id,meter_code,period_start,period_end)
);

COMMIT;
