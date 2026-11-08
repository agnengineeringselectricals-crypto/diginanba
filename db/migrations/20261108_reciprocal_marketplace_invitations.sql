-- Reciprocal marketplace invitations and accepted customer/workspace connections.
-- Additive only: preserves existing CRM customers and consent records.
CREATE TABLE IF NOT EXISTS marketplace_relationship_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE,
  direction text NOT NULL CHECK (direction IN ('owner_to_customer','customer_to_owner')),
  inviter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  workspace_account_id uuid REFERENCES marketplace_customer_accounts(id) ON DELETE CASCADE,
  category_key text NOT NULL,
  workspace_key text NOT NULL,
  message_channel text NOT NULL DEFAULT 'link' CHECK (message_channel IN ('link','whatsapp','sms')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((direction = 'owner_to_customer' AND workspace_account_id IS NOT NULL) OR direction = 'customer_to_owner')
);
CREATE INDEX IF NOT EXISTS idx_marketplace_invites_inviter_created
  ON marketplace_relationship_invitations(inviter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_invites_invitee_pending
  ON marketplace_relationship_invitations(invitee_user_id, status) WHERE invitee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_invites_expiry
  ON marketplace_relationship_invitations(expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS marketplace_relationship_invitation_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES marketplace_relationship_invitations(id) ON DELETE CASCADE,
  accepted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_role text NOT NULL CHECK (accepted_role IN ('owner','customer')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  registration_completed boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_marketplace_invitation_acceptances_user
  ON marketplace_relationship_invitation_acceptances(accepted_by_user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_customer_workspace_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_account_id uuid NOT NULL REFERENCES marketplace_customer_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_invitation_id uuid UNIQUE REFERENCES marketplace_relationship_invitations(id) ON DELETE SET NULL,
  initiated_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiated_by_role text NOT NULL CHECK (initiated_by_role IN ('owner','customer')),
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','blocked')),
  is_favorite boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_customer_workspace_connections_unique
    UNIQUE (workspace_account_id, owner_user_id, customer_user_id),
  CHECK (owner_user_id <> customer_user_id)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_workspace_connections_customer
  ON marketplace_customer_workspace_connections(customer_user_id, status, is_pinned DESC, connected_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_workspace_connections_owner
  ON marketplace_customer_workspace_connections(owner_user_id, workspace_account_id, status, connected_at DESC);
COMMENT ON TABLE marketplace_relationship_invitations IS
  'Hashed, expiring, revocable invitations in either direction: workspace owner to customer or customer to workspace owner. Acceptance is required to create a connection.';
COMMENT ON TABLE marketplace_relationship_invitation_acceptances IS
  'Immutable acceptance record for reciprocal marketplace invitations; invitation delivery does not create a relationship.';
COMMENT ON TABLE marketplace_customer_workspace_connections IS
  'Accepted customer-to-workspace relationships. Drives customer dashboard connected shops and owner CRM customer lists; does not imply marketing consent.';
