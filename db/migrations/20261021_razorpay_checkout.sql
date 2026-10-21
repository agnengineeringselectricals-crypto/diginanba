-- Razorpay checkout mapping. Additive and safe to re-run.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_id_unique
  ON payments(provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_unique
  ON payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- The webhook event ID remains globally unique for replay protection.
