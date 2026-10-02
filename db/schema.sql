-- DigiNanba Phase 1 relational foundation
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, password_hash TEXT, display_name TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, description TEXT, is_system BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS permissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT NOT NULL UNIQUE, description TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_roles (user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE, granted_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id, role_id));
CREATE TABLE IF NOT EXISTS role_permissions (role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY(role_id, permission_id));
CREATE TABLE IF NOT EXISTS temporary_access (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, permission_id UUID NOT NULL REFERENCES permissions(id), starts_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, granted_by UUID REFERENCES users(id), reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id UUID REFERENCES users(id), action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, before_json JSONB, after_json JSONB, result TEXT NOT NULL DEFAULT 'success', ip_hash TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS markets (code TEXT PRIMARY KEY, country_name TEXT NOT NULL, currency_code CHAR(3) NOT NULL, locale TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, sort_order INT NOT NULL DEFAULT 0, enabled BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS products (category_id UUID REFERENCES categories(id), id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT, product_type TEXT NOT NULL, owner_type TEXT NOT NULL DEFAULT 'platform', status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);

CREATE TABLE IF NOT EXISTS product_editions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, market_code TEXT NOT NULL REFERENCES markets(code), locale TEXT NOT NULL, title TEXT NOT NULL, description TEXT, version TEXT NOT NULL DEFAULT '1.0', status TEXT NOT NULL DEFAULT 'draft', UNIQUE(product_id, market_code, locale, version));
CREATE TABLE IF NOT EXISTS prices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_edition_id UUID NOT NULL REFERENCES product_editions(id) ON DELETE CASCADE, currency_code CHAR(3) NOT NULL, amount_minor BIGINT NOT NULL, valid_from TIMESTAMPTZ NOT NULL DEFAULT now(), valid_to TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), market_code TEXT REFERENCES markets(code), currency_code CHAR(3) NOT NULL, subtotal_minor BIGINT NOT NULL, tax_minor BIGINT NOT NULL DEFAULT 0, total_minor BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_edition_id UUID NOT NULL REFERENCES product_editions(id), quantity INT NOT NULL DEFAULT 1, unit_amount_minor BIGINT NOT NULL, total_amount_minor BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS downloads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE, asset_key TEXT NOT NULL, download_count INT NOT NULL DEFAULT 0, last_downloaded_at TIMESTAMPTZ);
INSERT INTO markets(code,country_name,currency_code,locale) VALUES ('US','United States','USD','en-US'),('UK','United Kingdom','GBP','en-GB') ON CONFLICT DO NOTHING;
INSERT INTO roles(name,description) VALUES ('Super Admin','Full platform administration'),('Operations Admin','Operational maintenance'),('Catalog Manager','Catalog and publishing'),('Finance Manager','Finance and settlement operations'),('Support Agent','Customer support'),('AI Factory Manager','AI Product Factory operations'),('Read-Only Analyst','Analytics read access') ON CONFLICT DO NOTHING;


INSERT INTO categories(slug,name,description,sort_order) VALUES
('business-entrepreneurship','Business & Entrepreneurship','Practical resources for building and running a business.',1),
('finance-accounting','Finance & Accounting','Tools for budgets, cash flow and financial operations.',2),
('ai-automation','AI & Automation','Reusable AI workflows and automation resources.',3),
('career-professional','Career & Professional','Career, freelance and professional productivity resources.',4),
('excel-sheets','Excel & Sheets','Spreadsheets, calculators and data tools.',5),
('marketing-sales','Marketing & Sales','Marketing systems, content and sales resources.',6),
('templates-documents','Templates & Documents','Ready-to-use business and document templates.',7)
ON CONFLICT DO NOTHING;

INSERT INTO products(category_id,slug,title,description,product_type,owner_type,status) VALUES
((SELECT id FROM categories WHERE slug='business-entrepreneurship'),'business-growth-planner','Business Growth Planner','A practical planning toolkit for small businesses.','template','platform','published'),
((SELECT id FROM categories WHERE slug='finance-accounting'),'invoice-cashflow-toolkit','Invoice & Cashflow Toolkit','Templates and spreadsheets for tracking business cash flow.','spreadsheet','platform','published'),
((SELECT id FROM categories WHERE slug='ai-automation'),'ai-prompt-workflow-library','AI Prompt Workflow Library','Reusable workflows for everyday business tasks.','guide','platform','published'),
((SELECT id FROM categories WHERE slug='career-professional'),'freelance-proposal-pack','Freelance Proposal Pack','Professional proposal and client onboarding templates.','template','platform','published'),
((SELECT id FROM categories WHERE slug='marketing-sales'),'creator-content-calendar','Creator Content Calendar','A 90-day content planning system for consistent publishing.','template','platform','published'),
((SELECT id FROM categories WHERE slug='excel-sheets'),'project-cost-calculator','Project Cost Calculator','A spreadsheet toolkit for estimating project cost and margin.','spreadsheet','platform','published'),
((SELECT id FROM categories WHERE slug='business-entrepreneurship'),'startup-operations-playbook','Startup Operations Playbook','Practical SOPs and checklists for an early-stage team.','guide','platform','published'),
((SELECT id FROM categories WHERE slug='templates-documents'),'client-onboarding-system','Client Onboarding System','A reusable workflow for collecting requirements and starting projects.','template','platform','published')
ON CONFLICT DO NOTHING;

INSERT INTO product_editions(product_id,market_code,locale,title,description,status)
SELECT p.id,'US','en-US',p.title,p.description,'published' FROM products p WHERE p.slug IN ('business-growth-planner','invoice-cashflow-toolkit','ai-prompt-workflow-library','freelance-proposal-pack','creator-content-calendar','project-cost-calculator','startup-operations-playbook','client-onboarding-system')
ON CONFLICT DO NOTHING;
INSERT INTO product_editions(product_id,market_code,locale,title,description,status)
SELECT p.id,'UK','en-GB',p.title,p.description,'published' FROM products p WHERE p.slug IN ('business-growth-planner','invoice-cashflow-toolkit','ai-prompt-workflow-library','freelance-proposal-pack','creator-content-calendar','project-cost-calculator','startup-operations-playbook','client-onboarding-system')
ON CONFLICT DO NOTHING;

INSERT INTO prices(product_edition_id,currency_code,amount_minor)
SELECT pe.id,'USD',v.amount FROM product_editions pe JOIN (VALUES
('business-growth-planner',1999),('invoice-cashflow-toolkit',1499),('ai-prompt-workflow-library',1299),('freelance-proposal-pack',999),('creator-content-calendar',1299),('project-cost-calculator',1499),('startup-operations-playbook',1799),('client-onboarding-system',1099)
) v(slug,amount) ON pe.market_code='US' JOIN products p ON p.id=pe.product_id AND p.slug=v.slug WHERE NOT EXISTS (SELECT 1 FROM prices x WHERE x.product_edition_id=pe.id AND x.valid_to IS NULL);
INSERT INTO prices(product_edition_id,currency_code,amount_minor)
SELECT pe.id,'GBP',v.amount FROM product_editions pe JOIN (VALUES
('business-growth-planner',1599),('invoice-cashflow-toolkit',1199),('ai-prompt-workflow-library',999),('freelance-proposal-pack',799),('creator-content-calendar',999),('project-cost-calculator',1199),('startup-operations-playbook',1399),('client-onboarding-system',899)
) v(slug,amount) ON pe.market_code='UK' JOIN products p ON p.id=pe.product_id AND p.slug=v.slug WHERE NOT EXISTS (SELECT 1 FROM prices x WHERE x.product_edition_id=pe.id AND x.valid_to IS NULL);


-- v0.5 checkout/payment foundation
CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, provider TEXT NOT NULL, provider_payment_id TEXT UNIQUE, currency_code CHAR(3) NOT NULL, amount_minor BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', raw_reference JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS payment_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_id UUID REFERENCES payments(id) ON DELETE SET NULL, provider TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL, payload JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS entitlements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'active', granted_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, order_item_id));
