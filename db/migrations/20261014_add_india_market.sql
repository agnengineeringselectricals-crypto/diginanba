-- DigiNanba MVP: add India as a supported storefront market.
-- Safe to run repeatedly against an existing Neon/PostgreSQL database.
INSERT INTO markets(code,country_name,currency_code,locale)
VALUES ('IN','India','INR','en-IN')
ON CONFLICT (code) DO UPDATE SET country_name=EXCLUDED.country_name,currency_code=EXCLUDED.currency_code,locale=EXCLUDED.locale,enabled=true;

INSERT INTO product_editions(product_id,market_code,locale,title,description,status,version)
SELECT p.id,'IN','en-IN',p.title,p.description,'published','1.0'
FROM products p
WHERE p.slug IN ('business-growth-planner','invoice-cashflow-toolkit','ai-prompt-workflow-library','freelance-proposal-pack','creator-content-calendar','project-cost-calculator','startup-operations-playbook','client-onboarding-system')
ON CONFLICT (product_id,market_code,locale,version) DO UPDATE
SET title=EXCLUDED.title,description=EXCLUDED.description,status='published';

INSERT INTO prices(product_edition_id,currency_code,amount_minor)
SELECT pe.id,'INR',v.amount
FROM product_editions pe
JOIN products p ON p.id=pe.product_id
JOIN (VALUES
('business-growth-planner',149900),
('invoice-cashflow-toolkit',99900),
('ai-prompt-workflow-library',89900),
('freelance-proposal-pack',69900),
('creator-content-calendar',89900),
('project-cost-calculator',99900),
('startup-operations-playbook',129900),
('client-onboarding-system',79900)
) AS v(slug,amount) ON v.slug=p.slug
WHERE pe.market_code='IN' AND pe.locale='en-IN' AND pe.status='published'
AND NOT EXISTS (SELECT 1 FROM prices existing WHERE existing.product_edition_id=pe.id AND existing.currency_code='INR' AND existing.valid_to IS NULL);
