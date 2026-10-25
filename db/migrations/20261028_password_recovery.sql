CREATE TABLE IF NOT EXISTS password_reset_request_events (
  id BIGSERIAL PRIMARY KEY,
  email_key TEXT NOT NULL,
  ip_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_request_email_time_idx
  ON password_reset_request_events(email_key, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_request_ip_time_idx
  ON password_reset_request_events(ip_key, created_at DESC);

-- Keep the rate-limit audit table bounded; run this cleanup during requests.
CREATE INDEX IF NOT EXISTS password_reset_request_created_at_idx
  ON password_reset_request_events(created_at);
