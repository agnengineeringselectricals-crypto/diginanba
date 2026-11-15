-- Client and Supplier Portals: external access, RFQs, quotations and client project links.
BEGIN;

ALTER TABLE pm_suppliers ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE pm_suppliers ADD COLUMN IF NOT EXISTS specializations jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pm_suppliers ADD COLUMN IF NOT EXISTS website_url text;
CREATE INDEX IF NOT EXISTS pm_suppliers_category_idx ON pm_suppliers(organization_id,category,status);

CREATE TABLE IF NOT EXISTS pm_project_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_project_clients_project_fk FOREIGN KEY (organization_id,project_id)
    REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT pm_project_clients_client_fk FOREIGN KEY (organization_id,client_id)
    REFERENCES pm_clients(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT pm_project_clients_unique UNIQUE (organization_id,project_id,client_id)
);
CREATE INDEX IF NOT EXISTS pm_project_clients_client_idx
  ON pm_project_clients(organization_id,client_id,created_at DESC);

CREATE TABLE IF NOT EXISTS pm_supplier_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  enquiry_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_delivery_date date,
  submission_deadline timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','closed','cancelled')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_supplier_enquiries_project_fk FOREIGN KEY (organization_id,project_id)
    REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT pm_supplier_enquiries_number_uq UNIQUE (organization_id,enquiry_number)
);
CREATE INDEX IF NOT EXISTS pm_supplier_enquiries_project_idx
  ON pm_supplier_enquiries(organization_id,project_id,status,created_at DESC);

ALTER TABLE pm_supplier_enquiries ADD COLUMN IF NOT EXISTS source_indent_id uuid;
CREATE INDEX IF NOT EXISTS pm_supplier_enquiries_source_indent_idx
  ON pm_supplier_enquiries(organization_id,source_indent_id) WHERE source_indent_id IS NOT NULL;
ALTER TABLE pm_supplier_enquiries ADD CONSTRAINT pm_supplier_enquiries_source_indent_fk FOREIGN KEY (organization_id,source_indent_id) REFERENCES pm_material_indents(organization_id,id) ON DELETE RESTRICT;


CREATE TABLE IF NOT EXISTS pm_supplier_enquiry_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  enquiry_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  response_status text NOT NULL DEFAULT 'invited'
    CHECK (response_status IN ('invited','viewed','quoted','declined','withdrawn')),
  response_note text NOT NULL DEFAULT '',
  CONSTRAINT pm_supplier_enquiry_invites_enquiry_fk FOREIGN KEY (organization_id,enquiry_id)
    REFERENCES pm_supplier_enquiries(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT pm_supplier_enquiry_invites_supplier_fk FOREIGN KEY (organization_id,supplier_id)
    REFERENCES pm_suppliers(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT pm_supplier_enquiry_invites_unique UNIQUE (organization_id,enquiry_id,supplier_id)
);
CREATE INDEX IF NOT EXISTS pm_supplier_enquiry_invites_supplier_idx
  ON pm_supplier_enquiry_invites(organization_id,supplier_id,invited_at DESC);

CREATE TABLE IF NOT EXISTS pm_supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  enquiry_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  quote_number text NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'INR',
  subtotal numeric(18,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total numeric(18,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  delivery_days integer CHECK (delivery_days IS NULL OR delivery_days >= 0),
  valid_until date,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','shortlisted','accepted','rejected','withdrawn')),
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_supplier_quotes_enquiry_fk FOREIGN KEY (organization_id,enquiry_id)
    REFERENCES pm_supplier_enquiries(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT pm_supplier_quotes_supplier_fk FOREIGN KEY (organization_id,supplier_id)
    REFERENCES pm_suppliers(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT pm_supplier_quotes_number_uq UNIQUE (organization_id,quote_number),
  CONSTRAINT pm_supplier_quotes_supplier_enquiry_uq UNIQUE (organization_id,enquiry_id,supplier_id)
);
CREATE INDEX IF NOT EXISTS pm_supplier_quotes_enquiry_compare_idx
  ON pm_supplier_quotes(organization_id,enquiry_id,total_amount,delivery_days);

CREATE UNIQUE INDEX IF NOT EXISTS pm_supplier_quotes_org_id_uq ON pm_supplier_quotes(organization_id,id);
ALTER TABLE pm_purchase_orders ADD COLUMN IF NOT EXISTS supplier_quote_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS pm_purchase_orders_supplier_quote_uq
  ON pm_purchase_orders(organization_id,supplier_quote_id) WHERE supplier_quote_id IS NOT NULL;
ALTER TABLE pm_purchase_orders ADD CONSTRAINT pm_purchase_orders_supplier_quote_fk FOREIGN KEY (organization_id,supplier_quote_id) REFERENCES pm_supplier_quotes(organization_id,id) ON DELETE RESTRICT;


CREATE TABLE IF NOT EXISTS pm_portal_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  portal_member_id uuid NOT NULL,
  project_id uuid,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_portal_activity_member_fk FOREIGN KEY (organization_id,portal_member_id)
    REFERENCES pm_external_portal_members(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pm_portal_activity_member_idx
  ON pm_portal_activity_events(organization_id,portal_member_id,created_at DESC);

COMMIT;
