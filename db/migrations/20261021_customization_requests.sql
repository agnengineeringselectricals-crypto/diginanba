-- DigiNanba customization requests. Additive only; requests never create orders or charges.
BEGIN;
CREATE TABLE IF NOT EXISTS product_customization_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id UUID REFERENCES products(id) ON DELETE SET NULL,
 requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
 visitor_hash TEXT,
 title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
 description TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 5000),
 request_kind TEXT NOT NULL CHECK (request_kind IN ('format_conversion','localization','feature_extension','workflow','new_product','other')),
 target_market_code CHAR(2) NOT NULL DEFAULT 'IN' CHECK (target_market_code IN ('IN','US','UK')),
 target_locale TEXT NOT NULL DEFAULT 'en-IN',
 preferred_format TEXT NOT NULL DEFAULT 'not_sure' CHECK (preferred_format IN ('editable_file','interactive_tool','localized_version','team_workflow','not_sure')),
 budget_range TEXT NOT NULL DEFAULT 'not_sure' CHECK (budget_range IN ('not_sure','free_or_low_cost','under_1000_inr','1000_5000_inr','custom_quote')),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','triaged','feasibility_review','quoted','accepted','in_progress','delivered','rejected','cancelled')),
 reviewer_notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_customization_requests_status_created_idx ON product_customization_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS product_customization_requests_user_created_idx ON product_customization_requests(requested_by,created_at DESC) WHERE requested_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_customization_requests_product_idx ON product_customization_requests(product_id,created_at DESC) WHERE product_id IS NOT NULL;
COMMIT;
