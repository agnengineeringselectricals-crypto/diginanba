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
CREATE TABLE IF NOT EXISTS categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, sort_order INT NOT NULL DEFAULT 0, enabled BOOLEAN NOT NULL DEFAULT true, search_terms TEXT[] NOT NULL DEFAULT '{}');
ALTER TABLE categories ADD COLUMN IF NOT EXISTS search_terms TEXT[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS subcategories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT, sort_order INT NOT NULL DEFAULT 0, enabled BOOLEAN NOT NULL DEFAULT true, search_terms TEXT[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(category_id, slug), UNIQUE(id, category_id));
CREATE TABLE IF NOT EXISTS products (category_id UUID REFERENCES categories(id), subcategory_id UUID, id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT, product_type TEXT NOT NULL, owner_type TEXT NOT NULL DEFAULT 'platform', status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_subcategory_category_fk' AND conrelid='products'::regclass) THEN
    ALTER TABLE products ADD CONSTRAINT products_subcategory_category_fk FOREIGN KEY (subcategory_id, category_id) REFERENCES subcategories(id, category_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS subcategories_parent_order_idx ON subcategories(category_id, enabled, sort_order);
CREATE INDEX IF NOT EXISTS products_subcategory_id_idx ON products(subcategory_id);

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
('templates-documents','Templates & Documents','Ready-to-use business and document templates.',7),
('ebooks-guides','Ebooks & Guides','Practical guides and ebooks for work and learning.',8),
('design-assets','Design Assets','Editable design resources and creative assets.',9),
('education-learning','Education & Learning','Courses and resources for learning new skills.',10),
('software-code','Software / Code','Software, coding resources and app-building tools.',11),
('cad-engineering','CAD / Engineering','Engineering and technical design resources.',12),
('video-audio','Video / Audio','Resources for video, audio and content production.',13),
('photography','Photography','Photography tools, guides and creative resources.',14),
('printables','Printables','Printable planners, worksheets and practical tools.',15),
('personal-lifestyle','Personal / Lifestyle','Resources for personal goals, habits and everyday life.',16)
ON CONFLICT DO NOTHING;

UPDATE categories SET search_terms=ARRAY['books','guide','reading'] WHERE slug='ebooks-guides' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['spreadsheet','budget','accounting','invoice','calculator'] WHERE slug='excel-sheets' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['resume','résumé','cv','project management','documents','checklist'] WHERE slug='templates-documents' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['instagram','social media','logo','creative','graphics'] WHERE slug='design-assets' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['instagram','seo','advertising','promotion','sales'] WHERE slug='marketing-sales' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['artificial intelligence','workflow','automate','productivity'] WHERE slug='ai-automation' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['business plan','startup','entrepreneur','company'] WHERE slug='business-entrepreneurship' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['learn','course','python','skill','training'] WHERE slug='education-learning' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['app','application','python','coding','software','programming'] WHERE slug='software-code' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['drawing','technical','engineering','design'] WHERE slug='cad-engineering' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['accounting','budget','invoice','cashflow','cash flow','finance'] WHERE slug='finance-accounting' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['resume','résumé','cv','job','career','cover letter'] WHERE slug='career-professional' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['video','audio','content','creator','podcast'] WHERE slug='video-audio' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['photo','photography','image','picture'] WHERE slug='photography' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['printable','planner','worksheet'] WHERE slug='printables' AND search_terms='{}';
UPDATE categories SET search_terms=ARRAY['personal','goals','habits','wellness','routine'] WHERE slug='personal-lifestyle' AND search_terms='{}';

-- Admin-managed category → subcategory → product taxonomy.
INSERT INTO subcategories(category_id,slug,name,sort_order,search_terms)
SELECT c.id,v.slug,v.name,v.sort_order,v.search_terms FROM (VALUES
('ebooks-guides','business-guides','Business Guides',1,ARRAY['business guide','entrepreneur']),('ebooks-guides','how-to-guides','How-to Guides',2,ARRAY['how to','step by step']),('ebooks-guides','self-help','Self-Help',3,ARRAY['self help','personal growth']),('ebooks-guides','technical-guides','Technical Guides',4,ARRAY['technical','engineering']),('ebooks-guides','exam-preparation','Exam Preparation',5,ARRAY['exam','test prep']),
('excel-sheets','finance-accounting','Finance & Accounting',1,ARRAY['finance','accounting','cashflow','invoice']),('excel-sheets','budgeting','Budgeting',2,ARRAY['budget','budgeting']),('excel-sheets','business-templates','Business Templates',3,ARRAY['business template','business spreadsheet']),('excel-sheets','dashboards','Dashboards',4,ARRAY['dashboard','kpi']),('excel-sheets','data-analysis','Data Analysis',5,ARRAY['data analysis','analytics']),
('templates-documents','business-documents','Business Documents',1,ARRAY['business','proposal','onboarding']),('templates-documents','project-management','Project Management',2,ARRAY['project','management']),('templates-documents','resumes-cvs','Resumes & CVs',3,ARRAY['resume','résumé','cv']),('templates-documents','checklists','Checklists',4,ARRAY['checklist','sop']),('templates-documents','planners','Planners',5,ARRAY['planner','planning']),
('design-assets','social-media-design','Social Media Design',1,ARRAY['social media','instagram']),('design-assets','brand-identity','Brand Identity',2,ARRAY['brand','logo']),('design-assets','presentations','Presentations',3,ARRAY['presentation','slides']),('design-assets','ui-ux-assets','UI / UX Assets',4,ARRAY['ui','ux','interface']),('design-assets','creative-templates','Creative Templates',5,ARRAY['design kit','creative']),
('marketing-sales','social-media','Social Media',1,ARRAY['social media','instagram','content calendar']),('marketing-sales','seo','SEO',2,ARRAY['seo','search engine']),('marketing-sales','email-marketing','Email Marketing',3,ARRAY['email','newsletter']),('marketing-sales','sales-templates','Sales Templates',4,ARRAY['sales','proposal']),('marketing-sales','advertising','Advertising',5,ARRAY['advertising','ads','promotion']),
('ai-automation','ai-prompts','AI Prompts',1,ARRAY['prompt','prompts']),('ai-automation','ai-agents','AI Agents',2,ARRAY['agent','agents']),('ai-automation','ai-workflows','AI Workflows',3,ARRAY['workflow','workflows']),('ai-automation','automation-templates','Automation Templates',4,ARRAY['automation','automate']),('ai-automation','productivity','Productivity',5,ARRAY['productivity','task']),
('business-entrepreneurship','business-plans','Business Plans',1,ARRAY['business plan','growth planner']),('business-entrepreneurship','starting-a-business','Starting a Business',2,ARRAY['startup','launch']),('business-entrepreneurship','business-operations','Business Operations',3,ARRAY['operations','sop']),('business-entrepreneurship','freelancing','Freelancing',4,ARRAY['freelance','client']),('business-entrepreneurship','business-growth','Business Growth',5,ARRAY['growth','sales']),
('education-learning','online-courses','Online Courses',1,ARRAY['course','training']),('education-learning','study-guides','Study Guides',2,ARRAY['study','learning guide']),('education-learning','exam-prep','Exam Preparation',3,ARRAY['exam','test prep']),('education-learning','skill-roadmaps','Skill Roadmaps',4,ARRAY['roadmap','skill']),('education-learning','coding-education','Coding',5,ARRAY['coding','programming','python']),
('software-code','app-starter-kits','App Starter Kits',1,ARRAY['app','application']),('software-code','web-development','Web Development',2,ARRAY['web','website','frontend']),('software-code','python','Python',3,ARRAY['python']),('software-code','no-code-tools','No-code Tools',4,ARRAY['no code','nocode']),('software-code','developer-resources','Developer Resources',5,ARRAY['developer','software','code']),
('cad-engineering','autocad','AutoCAD',1,ARRAY['autocad','cad']),('cad-engineering','electrical-engineering','Electrical',2,ARRAY['electrical','circuit']),('cad-engineering','mechanical-engineering','Mechanical',3,ARRAY['mechanical']),('cad-engineering','civil-engineering','Civil',4,ARRAY['civil','structural']),('cad-engineering','engineering-calculations','Engineering Calculations',5,ARRAY['calculation','calculator']),
('finance-accounting','personal-finance','Personal Finance',1,ARRAY['personal finance','budget']),('finance-accounting','bookkeeping','Bookkeeping',2,ARRAY['bookkeeping','accounting']),('finance-accounting','invoicing','Invoicing',3,ARRAY['invoice','invoicing']),('finance-accounting','cash-flow','Cash Flow',4,ARRAY['cashflow','cash flow']),('finance-accounting','tax-planning','Tax Planning',5,ARRAY['tax']),
('career-professional','resumes-cvs','Resumes & CVs',1,ARRAY['resume','résumé','cv']),('career-professional','job-search','Job Search',2,ARRAY['job','career']),('career-professional','interview-prep','Interview Preparation',3,ARRAY['interview']),('career-professional','freelance-career','Freelance Career',4,ARRAY['freelance','proposal']),('career-professional','professional-development','Professional Development',5,ARRAY['professional','development']),
('video-audio','video-editing','Video Editing',1,ARRAY['video','editing']),('video-audio','video-scripts','Scripts & Storyboards',2,ARRAY['script','storyboard']),('video-audio','audio-resources','Audio Resources',3,ARRAY['audio','sound']),('video-audio','podcasting','Podcasting',4,ARRAY['podcast']),('video-audio','content-production','Content Production',5,ARRAY['content','creator']),
('photography','photo-editing','Photo Editing',1,ARRAY['photo editing','lightroom']),('photography','presets','Presets',2,ARRAY['preset']),('photography','stock-photography','Stock Photography',3,ARRAY['stock photo','image']),('photography','photo-planning','Session Planning',4,ARRAY['photo session','shot list']),('photography','lighting','Lighting',5,ARRAY['lighting','studio']),
('printables','printable-planners','Planners',1,ARRAY['planner']),('printables','worksheets','Worksheets',2,ARRAY['worksheet']),('printables','trackers','Trackers',3,ARRAY['tracker']),('printables','kids-printables','Kids & Classroom',4,ARRAY['kids','classroom']),('printables','home-printables','Home & Lifestyle',5,ARRAY['home','lifestyle']),
('personal-lifestyle','habits-goals','Habits & Goals',1,ARRAY['habit','goal']),('personal-lifestyle','wellness','Wellness',2,ARRAY['wellness','health']),('personal-lifestyle','journals','Journals',3,ARRAY['journal']),('personal-lifestyle','personal-productivity','Personal Productivity',4,ARRAY['productivity','routine']),('personal-lifestyle','hobbies','Hobbies',5,ARRAY['hobby','hobbies'])
) AS v(category_slug,slug,name,sort_order,search_terms) JOIN categories c ON c.slug=v.category_slug
ON CONFLICT(category_id,slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS marketplace_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '✦',
  category_names TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO marketplace_needs(key,label,icon,category_names,sort_order) VALUES
('start-business','Start a business','🚀',ARRAY['Business & Entrepreneurship','Ebooks & Guides'],1),
('manage-finances','Manage finances','💰',ARRAY['Finance & Accounting','Excel & Sheets'],2),
('grow-sales','Grow sales','📈',ARRAY['Marketing & Sales','Business & Entrepreneurship'],3),
('create-content','Create content','🎬',ARRAY['Video / Audio','Marketing & Sales','Design Assets'],4),
('learn-skill','Learn a skill','🎓',ARRAY['Education & Learning','Ebooks & Guides'],5),
('get-job','Get a job','💼',ARRAY['Career & Professional'],6),
('manage-projects','Manage projects','🗂️',ARRAY['Templates & Documents','Excel & Sheets'],7),
('automate-work','Automate work','⚙️',ARRAY['AI & Automation','Software / Code'],8),
('design-something','Design something','🎨',ARRAY['Design Assets','Photography','Printables'],9),
('build-app','Build an app','💻',ARRAY['Software / Code','CAD / Engineering'],10)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS discovery_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  category_names TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO discovery_rows(key,title,subtitle,category_names,sort_order) VALUES
('work-smarter','Work smarter','Useful resources for business, planning and productivity.',ARRAY['Business & Entrepreneurship','Finance & Accounting','Excel & Sheets','Marketing & Sales','AI & Automation'],1),
('learn-grow','Learn and grow','Build practical skills and take the next step in your career.',ARRAY['Ebooks & Guides','Education & Learning','Career & Professional','Software / Code','Business & Entrepreneurship'],2),
('create-build','Create and build','Bring creative ideas and new projects to life.',ARRAY['Design Assets','Video / Audio','CAD / Engineering','Photography','Printables','Personal / Lifestyle','Templates & Documents','Marketing & Sales','Excel & Sheets'],3)
ON CONFLICT (key) DO NOTHING;

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

UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='business-growth-planner' AND c.slug='business-entrepreneurship' AND s.slug='business-plans';
UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='invoice-cashflow-toolkit' AND c.slug='finance-accounting' AND s.slug='cash-flow';
UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='ai-prompt-workflow-library' AND c.slug='ai-automation' AND s.slug='ai-prompts';
UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='freelance-proposal-pack' AND c.slug='career-professional' AND s.slug='freelance-career';
UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='creator-content-calendar' AND c.slug='marketing-sales' AND s.slug='social-media';
UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='project-cost-calculator' AND c.slug='excel-sheets' AND s.slug='finance-accounting';
UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='startup-operations-playbook' AND c.slug='business-entrepreneurship' AND s.slug='business-operations';
UPDATE products p SET subcategory_id=s.id FROM categories c JOIN subcategories s ON s.category_id=c.id
WHERE p.category_id=c.id AND p.subcategory_id IS NULL AND p.slug='client-onboarding-system' AND c.slug='templates-documents' AND s.slug='business-documents';

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

-- Stage 1: private Autonomous Product Factory pipeline storage only.
-- No workers, AI integrations, APIs, or automatic publishing are enabled by these tables.
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (btrim(agent_type) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS agent_runs_status_created_idx ON agent_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_type_created_idx ON agent_runs(agent_type, created_at DESC);

CREATE TABLE IF NOT EXISTS research_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT NOT NULL REFERENCES markets(code),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  problem_statement TEXT NOT NULL CHECK (btrim(problem_statement) <> ''),
  opportunity_score NUMERIC(5,2) CHECK (opportunity_score BETWEEN 0 AND 100),
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','scoring','qualified','rejected','converted','archived')),
  source_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_opportunities_market_status_score_idx ON research_opportunities(market_code, status, opportunity_score DESC);
CREATE INDEX IF NOT EXISTS research_opportunities_created_idx ON research_opportunities(created_at DESC);

CREATE TABLE IF NOT EXISTS product_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES research_opportunities(id),
  product_id UUID REFERENCES products(id),
  job_type TEXT NOT NULL CHECK (btrim(job_type) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','awaiting_review','completed','failed','cancelled')),
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_jobs_opportunity_created_idx ON product_jobs(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_jobs_status_created_idx ON product_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_jobs_product_idx ON product_jobs(product_id) WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_job_id UUID NOT NULL REFERENCES product_jobs(id),
  product_id UUID REFERENCES products(id),
  asset_type TEXT NOT NULL CHECK (btrim(asset_type) <> ''),
  storage_key TEXT NOT NULL CHECK (btrim(storage_key) <> ''),
  file_name TEXT NOT NULL CHECK (btrim(file_name) <> ''),
  mime_type TEXT NOT NULL CHECK (btrim(mime_type) <> ''),
  version INT NOT NULL DEFAULT 1 CHECK (version > 0),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','validated','rejected','failed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_assets_job_created_idx ON product_assets(product_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_assets_product_idx ON product_assets(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_assets_status_idx ON product_assets(status);

CREATE TABLE IF NOT EXISTS localization_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  source_market_code TEXT NOT NULL REFERENCES markets(code),
  target_market_code TEXT NOT NULL REFERENCES markets(code),
  source_locale TEXT NOT NULL CHECK (btrim(source_locale) <> ''),
  target_locale TEXT NOT NULL CHECK (btrim(target_locale) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','review_required','completed','failed','cancelled')),
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_market_code <> target_market_code OR source_locale <> target_locale)
);
CREATE INDEX IF NOT EXISTS localization_jobs_product_created_idx ON localization_jobs(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS localization_jobs_target_status_idx ON localization_jobs(target_market_code, status, created_at DESC);

CREATE TABLE IF NOT EXISTS quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  product_job_id UUID REFERENCES product_jobs(id),
  check_type TEXT NOT NULL CHECK (btrim(check_type) <> ''),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','failed','warning','skipped')),
  score NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100),
  findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR product_job_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS quality_checks_product_checked_idx ON quality_checks(product_id, checked_at DESC) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quality_checks_job_checked_idx ON quality_checks(product_job_id, checked_at DESC) WHERE product_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quality_checks_status_checked_idx ON quality_checks(status, checked_at DESC);

CREATE TABLE IF NOT EXISTS publishing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  product_edition_id UUID REFERENCES product_editions(id),
  market_code TEXT NOT NULL REFERENCES markets(code),
  locale TEXT NOT NULL CHECK (btrim(locale) <> ''),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','awaiting_approval','approved','publishing','published','rejected','failed','cancelled')),
  approval_required BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR published_at IS NOT NULL),
  CHECK (approval_required IS FALSE OR status NOT IN ('publishing','published') OR approved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS publishing_jobs_status_created_idx ON publishing_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS publishing_jobs_product_market_idx ON publishing_jobs(product_id, market_code, locale);
CREATE INDEX IF NOT EXISTS publishing_jobs_approval_idx ON publishing_jobs(approval_required, status) WHERE approval_required IS TRUE;

CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id),
  event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warning','error')),
  message TEXT NOT NULL CHECK (btrim(message) <> ''),
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_events_run_created_idx ON agent_events(agent_run_id, created_at);
CREATE INDEX IF NOT EXISTS agent_events_level_created_idx ON agent_events(level, created_at DESC);

-- Stage 1 extension: private marketing/growth foundation and a fail-closed cost policy.
-- These tables do not connect external services or execute/schedule any work.
CREATE TABLE IF NOT EXISTS agent_financial_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL DEFAULT '*' CHECK (btrim(agent_type) <> ''),
  max_spend_minor BIGINT NOT NULL DEFAULT 0 CHECK (max_spend_minor = 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency_code ~ '^[A-Z]{3}$'),
  paid_actions_allowed BOOLEAN NOT NULL DEFAULT false CHECK (paid_actions_allowed IS FALSE),
  owner_approval_required BOOLEAN NOT NULL DEFAULT true CHECK (owner_approval_required IS TRUE),
  free_resource_allowed BOOLEAN NOT NULL DEFAULT true,
  unknown_cost_action TEXT NOT NULL DEFAULT 'block' CHECK (unknown_cost_action = 'block'),
  policy_status TEXT NOT NULL DEFAULT 'active' CHECK (policy_status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_type)
);
INSERT INTO agent_financial_policies(agent_type,max_spend_minor,currency_code,paid_actions_allowed,owner_approval_required,free_resource_allowed,unknown_cost_action,policy_status)
VALUES ('*',0,'INR',false,true,true,'block','active')
ON CONFLICT(agent_type) DO NOTHING;
CREATE INDEX IF NOT EXISTS agent_financial_policies_status_idx ON agent_financial_policies(policy_status, agent_type);

CREATE TABLE IF NOT EXISTS marketing_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code TEXT REFERENCES markets(code),
  country_code TEXT,
  region_code TEXT,
  state_code TEXT,
  zone_code TEXT,
  locale TEXT,
  product_id UUID REFERENCES products(id),
  category_id UUID REFERENCES categories(id),
  objective TEXT NOT NULL CHECK (btrim(objective) <> ''),
  strategy_type TEXT NOT NULL CHECK (btrim(strategy_type) <> ''),
  audience_definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  positioning_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review_required','approved','active','paused','completed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_strategies_market_status_idx ON marketing_strategies(market_code, status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_strategies_product_idx ON marketing_strategies(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_strategies_category_idx ON marketing_strategies(category_id) WHERE category_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES marketing_strategies(id),
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  objective TEXT NOT NULL CHECK (btrim(objective) <> ''),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_approval','approved','active','paused','completed','cancelled')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  budget_json JSONB,
  target_definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at),
  CHECK (status NOT IN ('approved','active') OR approval_required IS FALSE OR approved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_strategy_status_idx ON marketing_campaigns(strategy_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_campaigns_product_idx ON marketing_campaigns(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_campaigns_approval_idx ON marketing_campaigns(status, approved_at) WHERE approval_required IS TRUE;

CREATE TABLE IF NOT EXISTS marketing_campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  continent TEXT,
  country_code TEXT,
  region_code TEXT,
  state_code TEXT,
  zone_code TEXT,
  city TEXT,
  language_code TEXT,
  audience_segment TEXT,
  targeting_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_campaign_targets_campaign_idx ON marketing_campaign_targets(campaign_id, country_code, region_code);

CREATE TABLE IF NOT EXISTS audience_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT,
  market_code TEXT REFERENCES markets(code),
  country_code TEXT,
  region_code TEXT,
  state_code TEXT,
  zone_code TEXT,
  locale TEXT,
  segment_definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','paused','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audience_segments_market_status_idx ON audience_segments(market_code, status, name);

CREATE TABLE IF NOT EXISTS marketing_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  product_id UUID REFERENCES products(id),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  content_type TEXT NOT NULL CHECK (btrim(content_type) <> ''),
  locale TEXT NOT NULL CHECK (btrim(locale) <> ''),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  body TEXT NOT NULL,
  media_reference TEXT,
  call_to_action TEXT,
  destination_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','pending_approval','approved','rejected','archived')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approval_status <> 'approved' OR approved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_content_campaign_status_idx ON marketing_content(campaign_id, approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_content_product_idx ON marketing_content(product_id) WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketing_channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  account_name TEXT NOT NULL CHECK (btrim(account_name) <> ''),
  account_reference TEXT,
  market_code TEXT REFERENCES markets(code),
  status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('unconfigured','pending_authorization','authorized','disabled','revoked')),
  integration_type TEXT NOT NULL CHECK (btrim(integration_type) <> ''),
  permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (metadata_json ?| ARRAY['password','api_key','access_token','refresh_token','secret','token','credentials']))
);
CREATE INDEX IF NOT EXISTS marketing_channel_accounts_market_status_idx ON marketing_channel_accounts(market_code, status, channel);

CREATE TABLE IF NOT EXISTS marketing_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  marketing_content_id UUID NOT NULL REFERENCES marketing_content(id),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','scheduled','published','failed','cancelled')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  failure_reason TEXT,
  response_metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketing_publications_campaign_status_idx ON marketing_publications(campaign_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS marketing_publications_content_idx ON marketing_publications(marketing_content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  marketing_content_id UUID REFERENCES marketing_content(id),
  channel TEXT NOT NULL CHECK (btrim(channel) <> ''),
  market_code TEXT REFERENCES markets(code),
  country_code TEXT,
  region_code TEXT,
  metric_date DATE NOT NULL,
  impressions BIGINT CHECK (impressions >= 0),
  clicks BIGINT CHECK (clicks >= 0),
  visits BIGINT CHECK (visits >= 0),
  conversions BIGINT CHECK (conversions >= 0),
  sales BIGINT CHECK (sales >= 0),
  revenue_minor BIGINT CHECK (revenue_minor >= 0),
  spend_minor BIGINT CHECK (spend_minor >= 0),
  ctr NUMERIC(8,6) CHECK (ctr BETWEEN 0 AND 1),
  conversion_rate NUMERIC(8,6) CHECK (conversion_rate BETWEEN 0 AND 1),
  roas NUMERIC(12,4) CHECK (roas >= 0),
  metrics_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, marketing_content_id, channel, metric_date)
);
CREATE INDEX IF NOT EXISTS marketing_metrics_campaign_date_idx ON marketing_metrics(campaign_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS marketing_metrics_market_date_idx ON marketing_metrics(market_code, country_code, metric_date DESC);

CREATE TABLE IF NOT EXISTS marketing_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  experiment_type TEXT NOT NULL CHECK (btrim(experiment_type) <> ''),
  hypothesis TEXT NOT NULL CHECK (btrim(hypothesis) <> ''),
  variant_a_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  variant_b_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','running','completed','cancelled')),
  winner TEXT CHECK (winner IN ('a','b')),
  results_json JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS marketing_experiments_campaign_status_idx ON marketing_experiments(campaign_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (btrim(agent_type) <> ''),
  schedule_expression TEXT NOT NULL CHECK (btrim(schedule_expression) <> ''),
  timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (btrim(timezone) <> ''),
  enabled BOOLEAN NOT NULL DEFAULT false,
  configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_schedules_agent_enabled_idx ON agent_schedules(agent_type, enabled, next_run_at);
