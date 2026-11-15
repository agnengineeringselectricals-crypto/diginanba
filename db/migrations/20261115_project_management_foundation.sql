-- DigiNanba Project Management: multi-organization project execution foundation.
-- Additive only. Reuses organization_accounts and users; does not change marketplace data.
BEGIN;

CREATE TABLE IF NOT EXISTS pm_organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES organization_accounts(id) ON DELETE CASCADE,
  organization_type text NOT NULL DEFAULT 'company',
  industry_template text NOT NULL DEFAULT 'engineering_construction',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  default_currency char(3) NOT NULL DEFAULT 'INR',
  fiscal_year_start_month smallint NOT NULL DEFAULT 4 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pm_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  parent_department_id uuid,
  code text,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, code),
  FOREIGN KEY (organization_id, parent_department_id)
    REFERENCES pm_departments(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_departments_parent_idx ON pm_departments(organization_id,parent_department_id,status);

CREATE TABLE IF NOT EXISTS pm_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  level integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,name)
);

CREATE TABLE IF NOT EXISTS pm_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system_role boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,code)
);

CREATE TABLE IF NOT EXISTS pm_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  module_code text NOT NULL,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pm_role_permissions (
  organization_id uuid NOT NULL,
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL REFERENCES pm_permissions(id) ON DELETE CASCADE,
  access_scope text NOT NULL DEFAULT 'assigned' CHECK (access_scope IN ('organization','department','project','assigned','own')),
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id,permission_id),
  FOREIGN KEY (organization_id,role_id) REFERENCES pm_roles(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pm_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid,
  designation_id uuid,
  role_id uuid,
  reports_to_membership_id uuid,
  employee_code text,
  employment_type text NOT NULL DEFAULT 'employee',
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','inactive','removed')),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,user_id),
  FOREIGN KEY (organization_id) REFERENCES organization_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,department_id) REFERENCES pm_departments(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,designation_id) REFERENCES pm_designations(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,role_id) REFERENCES pm_roles(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,reports_to_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_memberships_department_idx ON pm_memberships(organization_id,department_id,status);
CREATE INDEX IF NOT EXISTS pm_memberships_reporting_idx ON pm_memberships(organization_id,reports_to_membership_id);

CREATE TABLE IF NOT EXISTS pm_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  project_code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  project_type text NOT NULL DEFAULT 'general',
  client_name text,
  client_reference text,
  location_text text,
  currency_code char(3) NOT NULL DEFAULT 'INR',
  baseline_start_date date,
  baseline_end_date date,
  actual_start_date date,
  actual_end_date date,
  forecast_end_date date,
  contract_value numeric(18,2),
  approved_budget numeric(18,2),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planning','active','on_hold','completed','cancelled','archived')),
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  project_manager_membership_id uuid,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,project_code),
  FOREIGN KEY (organization_id,project_manager_membership_id)
    REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_projects_status_dates_idx ON pm_projects(organization_id,status,baseline_end_date);

CREATE TABLE IF NOT EXISTS pm_project_members (
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  project_role text NOT NULL DEFAULT 'member',
  access_level text NOT NULL DEFAULT 'assigned' CHECK (access_level IN ('project_admin','project_read','assigned')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id,membership_id),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pm_work_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  parent_package_id uuid,
  package_code text,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,parent_package_id) REFERENCES pm_work_packages(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_work_packages_project_idx ON pm_work_packages(organization_id,project_id);

CREATE TABLE IF NOT EXISTS pm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  work_package_id uuid,
  parent_task_id uuid,
  task_code text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit text,
  target_quantity numeric(18,4),
  actual_quantity numeric(18,4) NOT NULL DEFAULT 0,
  baseline_start_date date,
  baseline_end_date date,
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  forecast_end_date date,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','blocked','on_hold','completed','cancelled')),
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  owner_membership_id uuid,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,work_package_id) REFERENCES pm_work_packages(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,parent_task_id) REFERENCES pm_tasks(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,owner_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_tasks_project_status_idx ON pm_tasks(organization_id,project_id,status,planned_end_date);
CREATE INDEX IF NOT EXISTS pm_tasks_owner_idx ON pm_tasks(organization_id,owner_membership_id,status);

CREATE TABLE IF NOT EXISTS pm_task_dependencies (
  organization_id uuid NOT NULL,
  task_id uuid NOT NULL,
  depends_on_task_id uuid NOT NULL,
  dependency_type text NOT NULL DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  lag_days integer NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id,depends_on_task_id),
  CHECK (task_id <> depends_on_task_id),
  FOREIGN KEY (organization_id,task_id) REFERENCES pm_tasks(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,depends_on_task_id) REFERENCES pm_tasks(organization_id,id) ON DELETE CASCADE
);

-- Shared target/actual/status ledger. Entity references are typed so new modules
-- can use the same KPI model without repeatedly altering their business tables.
CREATE TABLE IF NOT EXISTS pm_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  project_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metric_code text NOT NULL,
  metric_name text NOT NULL,
  unit text,
  baseline_target numeric(20,4),
  current_target numeric(20,4),
  actual_value numeric(20,4),
  current_status text NOT NULL DEFAULT 'not_started',
  variance numeric(20,4),
  planned_start_date date,
  planned_finish_date date,
  actual_start_date date,
  actual_finish_date date,
  forecast_finish_date date,
  responsible_membership_id uuid,
  deviation_reason text,
  corrective_action text,
  next_follow_up_at timestamptz,
  updated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,responsible_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_performance_entity_idx ON pm_performance_metrics(organization_id,entity_type,entity_id,metric_code);
CREATE INDEX IF NOT EXISTS pm_performance_followup_idx ON pm_performance_metrics(organization_id,next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS pm_performance_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  metric_id uuid NOT NULL REFERENCES pm_performance_metrics(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL DEFAULT now(),
  target_value numeric(20,4),
  actual_value numeric(20,4),
  status text,
  note text NOT NULL DEFAULT '',
  measured_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pm_measurements_metric_time_idx ON pm_performance_measurements(organization_id,metric_id,measured_at DESC);

CREATE TABLE IF NOT EXISTS pm_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  changed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pm_status_history_entity_idx ON pm_status_history(organization_id,entity_type,entity_id,changed_at DESC);

CREATE TABLE IF NOT EXISTS pm_follow_up_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  project_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_membership_id uuid,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,owner_membership_id) REFERENCES pm_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pm_followups_due_idx ON pm_follow_up_actions(organization_id,status,due_at);

CREATE TABLE IF NOT EXISTS pm_audit_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  project_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pm_audit_org_time_idx ON pm_audit_events(organization_id,created_at DESC);

-- Seed reusable permission catalogue; organizations assign these to their own roles.
INSERT INTO pm_permissions(code,module_code,description) VALUES
 ('projects.read','projects','View permitted projects'),
 ('projects.create','projects','Create projects'),
 ('projects.update','projects','Update project details'),
 ('projects.approve','projects','Approve project gates and baselines'),
 ('tasks.read','tasks','View permitted tasks'),
 ('tasks.create','tasks','Create tasks and work packages'),
 ('tasks.update','tasks','Update assigned tasks and progress'),
 ('tasks.assign','tasks','Assign work to team members'),
 ('tasks.approve','tasks','Approve task completion'),
 ('performance.read','analytics','View target, actual, variance and status'),
 ('performance.update','analytics','Record measurements and status'),
 ('finance.read','finance','View permitted budgets and actuals'),
 ('finance.approve','finance','Approve permitted financial transactions'),
 ('procurement.read','procurement','View indents and procurement'),
 ('procurement.create','procurement','Create material indents'),
 ('procurement.approve','procurement','Approve procurement requests'),
 ('documents.read','documents','View permitted documents'),
 ('documents.approve','documents','Approve controlled documents'),
 ('organization.manage','organization','Manage organization structure and members'),
 ('roles.manage','security','Manage roles and permissions')
ON CONFLICT (code) DO NOTHING;

COMMIT;
