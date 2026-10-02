import { db } from './db';
import type { Market } from './market';

export type CatalogProduct = {
  id: string; slug: string; title: string; description: string; category: string;
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
  ['client-onboarding-system','Client Onboarding System','A reusable workflow for collecting requirements and starting projects.','Templates & Documents',1099,899]
] as const;

export async function getProducts(market: Market, q=''): Promise<CatalogProduct[]> {
  try {
    const { rows } = await db.query(`
      SELECT p.id,p.slug,p.title,p.description,c.name category, pe.market_code, pr.currency_code, pr.amount_minor
      FROM products p
      JOIN product_editions pe ON pe.product_id=p.id AND pe.market_code=$1 AND pe.status='published'
      JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.status='published' AND ($2='' OR p.title ILIKE '%'||$2||'%' OR p.description ILIKE '%'||$2||'%')
      ORDER BY p.created_at DESC`, [market, q]);
    if (rows.length) return rows.map((r:any)=>formatRow(r, market));
  } catch {}
  return fallback.filter(x => !q || `${x[1]} ${x[2]} ${x[3]}`.toLowerCase().includes(q.toLowerCase())).map(x => ({
    id:x[0], slug:x[0], title:x[1], description:x[2], category:x[3], market,
    currency:market==='US'?'USD':'GBP', symbol:market==='US'?'$':'£', amountMinor:market==='US'?x[4]:x[5], price:formatMoney(market==='US'?x[4]:x[5], market)
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
