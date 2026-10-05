import { db } from './db';
import type { Market } from './market';

export type CatalogProduct = {
  id: string; slug: string; title: string; description: string; category: string;
  categorySlug?: string; subcategory?: string; subcategorySlug?: string;
  market: Market; currency: string; symbol: string; amountMinor: number; price: string;
};

const fallback = [
  ['business-growth-planner','Business Growth Planner','A practical planning toolkit for small businesses.','Business & Entrepreneurship',1999,1599],
  ['invoice-cashflow-toolkit','Invoice & Cashflow Toolkit','Templates and spreadsheets for tracking business cash flow.','Finance & Accounting',1499,1199],
  ['ai-prompt-workflow-library','AI Prompt Workflow Library','Reusable workflows for everyday business tasks.','AI & Automation',1299,999],
  ['freelance-proposal-pack','Freelance Proposal Pack','Professional proposal and client onboarding templates.','Career & Professional',999,799],
  ['creator-content-calendar','Creator Content Calendar','A 90-day content planning system for consistent publishing.','Marketing & Sales',1299,999],
  ['project-cost-calculator','Project Cost Calculator','A spreadsheet toolkit for estimating project cost and margin.','Excel & Sheets',1499,1199],
  ['startup-operations-playbook','Startup Operations Playbook','Practical SOPs and checklists for an early-stage team.','Business & Entrepreneurship',1799,1399],
  ['client-onboarding-system','Client Onboarding System','A reusable workflow for collecting requirements and starting projects.','Templates & Documents',1099,899],
  ['small-business-field-guide','Small Business Field Guide','A practical guide to launching and growing a small business.','Ebooks & Guides',899,699],
  ['learning-roadmap','Learning Roadmap Workbook','A guided workbook for planning a new skill and tracking progress.','Education & Learning',799,599],
  ['app-launch-starter-kit','App Launch Starter Kit','A project brief and launch checklist for your first software product.','Software / Code',1599,1299],
  ['engineering-project-log','Engineering Project Log','A structured project log for technical and engineering work.','CAD & Engineering',1299,999],
  ['content-creator-video-kit','Content Creator Video Kit','Shot lists, scripts and production notes for short-form video.','Video & Audio',1199,899],
  ['photo-session-planner','Photo Session Planner','Plan photography sessions, shot lists and delivery timelines.','Photography',699,499],
  ['printable-weekly-planner','Printable Weekly Planner','A clean printable planner for weekly priorities and routines.','Printables',499,399],
  ['personal-goal-journal','Personal Goal Journal','A simple guided journal for personal goals and reflection.','Personal & Lifestyle',599,499],
  ['social-media-design-kit','Social Media Design Kit','Editable design layouts for consistent social media publishing.','Design Assets',1099,899]
] as const;

const fallbackProductTaxonomy: Record<string, { categorySlug: string; subcategorySlug: string; subcategory: string }> = {
  'business-growth-planner': { categorySlug: 'business-entrepreneurship', subcategorySlug: 'business-plans', subcategory: 'Business Plans' },
  'invoice-cashflow-toolkit': { categorySlug: 'finance-accounting', subcategorySlug: 'cash-flow', subcategory: 'Cash Flow' },
  'ai-prompt-workflow-library': { categorySlug: 'ai-automation', subcategorySlug: 'ai-prompts', subcategory: 'AI Prompts' },
  'freelance-proposal-pack': { categorySlug: 'career-professional', subcategorySlug: 'freelance-career', subcategory: 'Freelance Career' },
  'creator-content-calendar': { categorySlug: 'marketing-sales', subcategorySlug: 'social-media', subcategory: 'Social Media' },
  'project-cost-calculator': { categorySlug: 'excel-sheets', subcategorySlug: 'finance-accounting', subcategory: 'Finance & Accounting' },
  'startup-operations-playbook': { categorySlug: 'business-entrepreneurship', subcategorySlug: 'business-operations', subcategory: 'Business Operations' },
  'client-onboarding-system': { categorySlug: 'templates-documents', subcategorySlug: 'business-documents', subcategory: 'Business Documents' },
  'small-business-field-guide': { categorySlug: 'ebooks-guides', subcategorySlug: 'business-guides', subcategory: 'Business Guides' },
  'learning-roadmap': { categorySlug: 'education-learning', subcategorySlug: 'skill-roadmaps', subcategory: 'Skill Roadmaps' },
  'app-launch-starter-kit': { categorySlug: 'software-code', subcategorySlug: 'app-starter-kits', subcategory: 'App Starter Kits' },
  'engineering-project-log': { categorySlug: 'cad-engineering', subcategorySlug: 'engineering-calculations', subcategory: 'Engineering Calculations' },
  'content-creator-video-kit': { categorySlug: 'video-audio', subcategorySlug: 'content-production', subcategory: 'Content Production' },
  'photo-session-planner': { categorySlug: 'photography', subcategorySlug: 'photo-planning', subcategory: 'Session Planning' },
  'printable-weekly-planner': { categorySlug: 'printables', subcategorySlug: 'printable-planners', subcategory: 'Planners' },
  'personal-goal-journal': { categorySlug: 'personal-lifestyle', subcategorySlug: 'journals', subcategory: 'Journals' },
  'social-media-design-kit': { categorySlug: 'design-assets', subcategorySlug: 'social-media-design', subcategory: 'Social Media Design' },
};

export async function getProducts(market: Market, q=''): Promise<CatalogProduct[]> {
  try {
    const { rows } = await db.query(`
      SELECT p.id,p.slug,p.title,p.description,c.name category,c.slug category_slug,
             sc.name subcategory,sc.slug subcategory_slug, pe.market_code, pr.currency_code, pr.amount_minor
      FROM products p
      JOIN product_editions pe ON pe.product_id=p.id AND pe.market_code=$1 AND pe.status='published'
      JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN subcategories sc ON sc.id=p.subcategory_id
      WHERE p.status='published' AND ($2='' OR p.title ILIKE '%'||$2||'%' OR p.description ILIKE '%'||$2||'%')
      ORDER BY p.created_at DESC`, [market, q]);
    if (rows.length) return rows.map((r:any)=>formatRow(r, market));
  } catch {}
  try {
    const { rows } = await db.query(`
      SELECT p.id,p.slug,p.title,p.description,c.name category,c.slug category_slug,
             pe.market_code,pr.currency_code,pr.amount_minor
      FROM products p
      JOIN product_editions pe ON pe.product_id=p.id AND pe.market_code=$1 AND pe.status='published'
      JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.status='published' AND ($2='' OR p.title ILIKE '%'||$2||'%' OR p.description ILIKE '%'||$2||'%')
      ORDER BY p.created_at DESC`, [market, q]);
    if (rows.length) return rows.map((r:any)=>formatRow(r, market));
  } catch {}
  return fallback.filter(x => !q || `${x[1]} ${x[2]} ${x[3]}`.toLowerCase().includes(q.toLowerCase())).map(x => ({
    id:x[0], slug:x[0], title:x[1], description:x[2], category:x[3], categorySlug:fallbackProductTaxonomy[x[0]]?.categorySlug,
    subcategorySlug:fallbackProductTaxonomy[x[0]]?.subcategorySlug, subcategory:fallbackProductTaxonomy[x[0]]?.subcategory, market,
    currency:market==='US'?'USD':'GBP', symbol:market==='US'?'$':'£', amountMinor:market==='US'?x[4]:x[5], price:formatMoney(market==='US'?x[4]:x[5], market)
  }));
}

export async function getProduct(slug:string, market:Market) {
  const products=await getProducts(market);
  return products.find(p=>p.slug===slug) ?? null;
}

function formatRow(r:any, market:Market):CatalogProduct {
  return {id:r.id,slug:r.slug,title:r.title,description:r.description||'',category:r.category||'Digital Products',categorySlug:r.category_slug,subcategory:r.subcategory||undefined,subcategorySlug:r.subcategory_slug||undefined,market,currency:r.currency_code,symbol:market==='US'?'$':'£',amountMinor:Number(r.amount_minor),price:formatMoney(Number(r.amount_minor),market)};
}
function formatMoney(minor:number, market:Market){return new Intl.NumberFormat(market==='US'?'en-US':'en-GB',{style:'currency',currency:market==='US'?'USD':'GBP'}).format(minor/100)}
