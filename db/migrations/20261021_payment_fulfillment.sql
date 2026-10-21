-- Indexes used by idempotent payment fulfillment and secure downloads.
-- Requires the existing product_assets table from migration 011.
CREATE UNIQUE INDEX IF NOT EXISTS downloads_order_item_asset_unique
  ON downloads(order_item_id, asset_key);
CREATE INDEX IF NOT EXISTS entitlements_user_status_idx
  ON entitlements(user_id, status, granted_at DESC);
