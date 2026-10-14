import { db } from './db';
import type { Market } from './market';

export type CatalogProduct = {
  id: string; slug: string; title: string; description: string; category: string;
  market: Market; currency: string; symbol: string; amountMinor: number; price: string;
};

const fallback = [
  ['business-growth-planner','Business Growth Planner','A practical planning toolkit for small businesses.','Business & Entrepreneurship',1999,1599,149900],
  ['invoice-cashflow-toolkit','Invoice & Cashflow Toolkit','Templates and spreadsheets for tracking business cash flow.','Finance & Accounting',1499,1199,99900],
  ['ai-prompt-workflow-library','AI Prompt Workflow Library','Reusable workflows for everyday business tasks.','AI & Automation',1299,999,89900],
  ['freelance-proposal-pack','Freelance Proposal Pack','Professional proposal and client onboarding templates.','Career & Professional',999,799,69900],
  ['creator-content-calendar','Creator Content Calendar','A 90-day content planning system for consistent publishing.','Marketing & Sales',1299,999,89900],
  ['project-cost-calculator','Project Cost Calculator','A spreadsheet toolkit for estimating project cost and margin.','Excel & Sheets',1499,1199,99900],
  ['startup-operations-playbook','Startup Operations Playbook','Practical SOPs and checklists for an early-stage team.','Business & Entrepreneurship',1799,1399,129900],
  ['client-onboarding-system','Client Onboarding System','A reusable workflow for collecting requirements and starting projects.','Templates & Documents',1099,899,79900]
] as const;

const categorySearchAliases: Record<string, string[]> = {
  'ebooks & guides': ['ebooks & guides'],
  'excel & sheets': ['excel & sheets', 'excel / google sheets'],
  'excel / google sheets': ['excel & sheets', 'excel / google sheets'],
  'templates & documents': ['templates & documents'],
  'design assets': ['design assets'],
  'marketing & sales': ['marketing & sales'],
  'ai & automation': ['ai & automation'],
  'business & entrepreneurship': ['business & entrepreneurship'],
  'education & learning': ['education & learning'],
  'software / code': ['software / code'],
  'cad & engineering': ['cad & engineering', 'cad / engineering'],
  'cad / engineering': ['cad & engineering', 'cad / engineering'],
  'finance & accounting': ['finance & accounting'],
  'career & professional': ['career & professional'],
  'video & audio': ['video & audio', 'video / audio'],
  'video / audio': ['video & audio', 'video / audio'],
  'photography': ['photography'],
  'printables': ['printables'],
  'personal & lifestyle': ['personal & lifestyle', 'personal / lifestyle'],
  'personal / lifestyle': ['personal & lifestyle', 'personal / lifestyle'],
};

export async function getProducts(market: Market, q=''): Promise<CatalogProduct[]> {
  const categoryAliases = categorySearchAliases[q.trim().toLowerCase()] ?? [];
  try {
    const { rows } = await db.query(`
      SELECT p.id,p.slug,p.title,p.description,c.name category, pe.market_code, pr.currency_code, pr.amount_minor
      FROM products p
      JOIN product_editions pe ON pe.product_id=p.id AND pe.market_code=$1 AND pe.status='published'
      JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.status='published' AND ($2='' OR p.title ILIKE '%'||$2||'%' OR p.description ILIKE '%'||$2||'%' OR COALESCE(c.name,'') ILIKE '%'||$2||'%' OR lower(COALESCE(c.name,'')) = ANY($3::text[]))
      ORDER BY p.created_at DESC`, [market, q, categoryAliases]);
    if (rows.length) return rows.map((r:any)=>formatRow(r, market));
  } catch {}
  return fallback.filter(x => !q || `${x[1]} ${x[2]} ${x[3]}`.toLowerCase().includes(q.toLowerCase()) || x[3].toLowerCase().includes(q.toLowerCase())).map(x => ({
    id:x[0], slug:x[0], title:x[1], description:x[2], category:x[3], market,
    currency:market==='US'?'USD':market==='UK'?'GBP':'INR', symbol:market==='US'?'$':market==='UK'?'£':'₹', amountMinor:market==='US'?x[4]:market==='UK'?x[5]:x[6], price:formatMoney(market==='US'?x[4]:market==='UK'?x[5]:x[6], market)'
  }));
}

export async function getProduct(slug:string, market:Market) {
  const products=await getProducts(market);
  return products.find(p=>p.slug===slug) ?? null;
}

function formatRow(r:any, market:Market):CatalogProduct {
  return {id:r.id,slug:r.slug,title:r.title,description:r.description||'',category:r.category||'Digital Products',market,currency:r.currency_code,symbol:market==='US'?',amountMinor:Number(r.amount_minor),price:formatMoney(Number(r.amount_minor),market)};
}
function formatMoney(minor:number, market:Market){const locale=market==='US'?'en-US':market==='UK'?'en-GB':'en-IN';const currency=market==='US'?'USD':market==='UK'?'GBP':'INR';return new Intl.NumberFormat(locale,{style:'currency',currency}).format(minor/100)}
:market==='UK'?'£':'₹', amountMinor:market==='US'?x[4]:market==='UK'?x[5]:x[6], price:formatMoney(market==='US'?x[4]:market==='UK'?x[5]:x[6], market)
  }));
}

export async function getProduct(slug:string, market:Market) {
  const products=await getProducts(market);
  return products.find(p=>p.slug===slug) ?? null;
}

function formatRow(r:any, market:Market):CatalogProduct {
  return {id:r.id,slug:r.slug,title:r.title,description:r.description||'',category:r.category||'Digital Products',market,currency:r.currency_code,symbol:market==='US'?'$':'£',amountMinor:Number(r.amount_minor),price:formatMoney(Number(r.amount_minor),market)};
}
function formatMoney(minor:number, market:Market){return new Intl.NumberFormat(market==='US'?'en-US':'en-GB',{style:'currency',currency:market==='US'?'USD':'GBP'}).format(minor/100)}
:market==='UK'?'£':'₹',amountMinor:Number(r.amount_minor),price:formatMoney(Number(r.amount_minor),market)};
}
function formatMoney(minor:number, market:Market){return new Intl.NumberFormat(market==='US'?'en-US':'en-GB',{style:'currency',currency:market==='US'?'USD':'GBP'}).format(minor/100)}
:market==='UK'?'£':'₹', amountMinor:market==='US'?x[4]:market==='UK'?x[5]:x[6], price:formatMoney(market==='US'?x[4]:market==='UK'?x[5]:x[6], market)
  }));
}

export async function getProduct(slug:string, market:Market) {
  const products=await getProducts(market);
  return products.find(p=>p.slug===slug) ?? null;
}

function formatRow(r:any, market:Market):CatalogProduct {
  return {id:r.id,slug:r.slug,title:r.title,description:r.description||'',category:r.category||'Digital Products',market,currency:r.currency_code,symbol:market==='US'?'$':'£',amountMinor:Number(r.amount_minor),price:formatMoney(Number(r.amount_minor),market)};
}
function formatMoney(minor:number, market:Market){return new Intl.NumberFormat(market==='US'?'en-US':'en-GB',{style:'currency',currency:market==='US'?'USD':'GBP'}).format(minor/100)}
