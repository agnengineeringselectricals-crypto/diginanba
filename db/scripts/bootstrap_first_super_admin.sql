-- One-time bootstrap: assign Super Admin to the EXISTING owner account only.
-- Run AFTER db/migrations/20261013_admin_hierarchy_rbac.sql in the intended Neon database.
-- Replace the email below with the exact email of your existing DigiNanba account.
-- Never commit a real email or database credential to GitHub.

BEGIN;

DO $bootstrap$
DECLARE
  owner_email TEXT := 'REPLACE_WITH_YOUR_EXISTING_ACCOUNT_EMAIL';
  owner_id UUID;
  super_admin_role_id UUID;
BEGIN
  IF owner_email = 'REPLACE_WITH_YOUR_EXISTING_ACCOUNT_EMAIL'
     OR position('@' IN owner_email) = 0 THEN
    RAISE EXCEPTION 'Edit owner_email to your existing account email before running this script.';
  END IF;

  SELECT id INTO owner_id
  FROM users
  WHERE lower(email) = lower(owner_email)
  LIMIT 1;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'No existing DigiNanba account found for that email. Sign up/sign in with the intended account first; no role was granted.';
  END IF;

  SELECT id INTO super_admin_role_id
  FROM roles
  WHERE name = 'Super Admin'
  LIMIT 1;

  IF super_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Super Admin role not found. Run the admin hierarchy migration first; no role was granted.';
  END IF;

  INSERT INTO user_roles (user_id, role_id, granted_by)
  VALUES (owner_id, super_admin_role_id, owner_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  INSERT INTO admin_permission_audit (actor_user_id, target_user_id, action, details)
  VALUES (
    owner_id,
    owner_id,
    'bootstrap_super_admin_role',
    jsonb_build_object('method', 'manual owner bootstrap', 'role', 'Super Admin')
  );
END
$bootstrap$;

COMMIT;

-- Verify assignment:
-- SELECT u.email, r.name
-- FROM users u
-- JOIN user_roles ur ON ur.user_id = u.id
-- JOIN roles r ON r.id = ur.role_id
-- WHERE lower(u.email) = lower('REPLACE_WITH_YOUR_EXISTING_ACCOUNT_EMAIL');
