-- Supporting indexes for idempotent payment fulfillment and secure download audit.
CREATE UNIQUE INDEX IF NOT EXISTS downloads_order_item_asset_unique
  ON downloads(order_item_id, asset_key);
CREATE INDEX IF NOT EXISTS entitlements_user_status_idx
  ON entitlements(user_id, status, granted_at DESC);
