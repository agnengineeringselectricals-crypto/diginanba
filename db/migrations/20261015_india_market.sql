-- Enable India as a supported product-factory and marketplace market.
-- Idempotent: safe to apply more than once.
INSERT INTO markets (code, country_name, currency_code, locale, enabled)
VALUES ('IN', 'India', 'INR', 'en-IN', true)
ON CONFLICT (code) DO UPDATE
SET country_name = EXCLUDED.country_name,
    currency_code = EXCLUDED.currency_code,
    locale = EXCLUDED.locale,
    enabled = true;
