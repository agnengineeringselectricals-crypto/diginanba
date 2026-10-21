-- Customer cancellation/refund request workflow. Refunds are never issued automatically by this table.
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 2000),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','under_review','approved','processing','refunded','rejected','failed')),
  provider_refund_id TEXT UNIQUE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_open_per_order
  ON refund_requests(order_id)
  WHERE status IN ('requested','under_review','approved','processing');

CREATE INDEX IF NOT EXISTS refund_requests_user_requested_idx
  ON refund_requests(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS refund_requests_status_requested_idx
  ON refund_requests(status, requested_at);
