-- Ask AI Nanba: privacy-conscious usage ledger for read-only project intelligence.
CREATE TABLE IF NOT EXISTS pm_ai_assistant_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization_accounts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  request_status text NOT NULL DEFAULT 'succeeded' CHECK (request_status IN ('succeeded','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_ai_assistant_usage_project_fk
    FOREIGN KEY (organization_id,project_id) REFERENCES pm_projects(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS pm_ai_assistant_usage_user_time_idx
  ON pm_ai_assistant_usage(organization_id,project_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS pm_ai_assistant_usage_org_time_idx
  ON pm_ai_assistant_usage(organization_id,created_at DESC);
