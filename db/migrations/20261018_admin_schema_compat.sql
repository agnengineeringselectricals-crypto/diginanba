-- Bring existing admin organization tables into line with the current migration
-- and application expectations without dropping or renaming existing columns.
-- Safe to rerun in Neon. Preserve legacy enabled/team_leader_user_id fields.

ALTER TABLE admin_departments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE admin_teams
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Preserve the existing enabled flag as the source of truth for legacy rows.
UPDATE admin_departments
SET status = CASE WHEN enabled IS TRUE THEN 'active' ELSE 'inactive' END
WHERE status IS NULL OR status NOT IN ('active', 'inactive')
   OR (enabled IS FALSE AND status = 'active');

UPDATE admin_teams
SET status = CASE WHEN enabled IS TRUE THEN 'active' ELSE 'inactive' END
WHERE status IS NULL OR status NOT IN ('active', 'inactive')
   OR (enabled IS FALSE AND status = 'active');

-- Add status constraints only if absent; do not replace existing constraints.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_departments_status_check'
      AND conrelid = 'admin_departments'::regclass
  ) THEN
    ALTER TABLE admin_departments
      ADD CONSTRAINT admin_departments_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_teams_status_check'
      AND conrelid = 'admin_teams'::regclass
  ) THEN
    ALTER TABLE admin_teams
      ADD CONSTRAINT admin_teams_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;
