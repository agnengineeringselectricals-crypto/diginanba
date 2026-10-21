-- Razorpay checkout foundation. Safe to apply repeatedly.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_id_unique
  ON payments(provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order_status_idx ON payments(order_id, status);
