import { db } from './db';
import type { Market } from './market';

export type CatalogProduct = {
  id: string; publicId: string; slug: string; title: string; description: string;
  category: string; creatorName: string; creatorId: string;
  market: Market; currency: string; symbol: string; amountMinor: number; price: string;
};

const fallback = [
  ['DN-P-000001','business-growth-planner','Business Growth Planner','A practical planning toolkit for small businesses.','Business & Entrepreneurship','DigiNanba','DN-C-000001',1999,1599,149900],
  ['DN-P-000002','invoice-cashflow-toolkit','Invoice & Cashflow Toolkit','Templates and spreadsheets for tracking business cash flow.','Finance & Accounting','DigiNanba','DN-C-000001',1499,1199,99900],
  ['DN-P-000003','ai-prompt-workflow-library','AI Prompt Workflow Library','Reusable workflows for everyday business tasks.','AI & Automation','DigiNanba','DN-C-000001',1299,999,89900],
  ['DN-P-000004','freelance-proposal-pack','Freelance Proposal Pack','Professional proposal and client onboarding templates.','Career & Professional','DigiNanba','DN-C-000001',999,799,69900],
  ['DN-P-000005','creator-content-calendar','Creator Content Calendar','A 90-day content planning system for consistent publishing.','Marketing & Sales','DigiNanba','DN-C-000001',1299,999,89900],
  ['DN-P-000006','project-cost-calculator','Project Cost Calculator','A spreadsheet toolkit for estimating project cost and margin.','Excel & Sheets','DigiNanba','DN-C-000001',1499,1199,99900],
  ['DN-P-000007','startup-operations-playbook','Startup Operations Playbook','Practical SOPs and checklists for an early-stage team.','Business & Entrepreneurship','DigiNanba','DN-C-000001',1799,1399,129900],
  ['DN-P-000008','client-onboarding-system','Client Onboarding System','A reusable workflow for collecting requirements and starting projects.','Templates & Documents','DigiNanba','DN-C-000001',1099,899,79900]
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
  const query = q.trim();
  try {
    const { rows } = await db.query(`
      SELECT p.id,p.public_id,p.slug,p.title,COALESCE(NULLIF(p.short_description,''),p.description,'') description,
             c.name category,pe.market_code,pr.currency_code,pr.amount_minor,
             COALESCE(cp.display_name,u.display_name,'DigiNanba') creator_name,
             COALESCE(u.public_id,'DN-C-000001') creator_id
      FROM products p
      JOIN product_editions pe ON pe.product_id=p.id AND pe.market_code=$1 AND pe.status='published'
      JOIN prices pr ON pr.product_edition_id=pe.id AND pr.valid_to IS NULL
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN users u ON u.id=p.creator_user_id
      LEFT JOIN creator_profiles cp ON cp.user_id=u.id
      WHERE p.status='published' AND (
        $2='' OR p.public_id ILIKE '%'||$2||'%' OR p.id::text ILIKE '%'||$2||'%' OR
        p.title ILIKE '%'||$2||'%' OR COALESCE(p.short_description,p.description,'') ILIKE '%'||$2||'%' OR
        p.description ILIKE '%'||$2||'%' OR COALESCE(c.name,'') ILIKE '%'||$2||'%' OR
        COALESCE(cp.display_name,u.display_name,'DigiNanba') ILIKE '%'||$2||'%' OR
        COALESCE(u.public_id,'DN-C-000001') ILIKE '%'||$2||'%' OR lower(COALESCE(c.name,'')) = ANY($3::text[])
      )
      ORDER BY CASE WHEN lower(p.public_id)=lower($2) OR lower(p.id::text)=lower($2) THEN 0
                    WHEN lower(p.title)=lower($2) THEN 1 WHEN p.title ILIKE $2||'%' THEN 2 ELSE 3 END,
               p.created_at DESC LIMIT 100`, [market, query, categoryAliases]);
    if (rows.length) return rows.map((r:any)=>formatRow(r, market));
  } catch {}
  return fallback.filter(x => !query || x.slice(0,7).join(' ').toLowerCase().includes(query.toLowerCase())).map(x => ({
    id:x[0], publicId:x[0], slug:x[1], title:x[2], description:x[3], category:x[4], creatorName:x[5], creatorId:x[6], market,
    currency:market==='US'?'USD':market==='UK'?'GBP':'INR', symbol:market==='US'?'$':market==='UK'?'£':'₹',
    amountMinor:market==='US'?x[7]:market==='UK'?x[8]:x[9],
    price:formatMoney(market==='US'?x[7]:market==='UK'?x[8]:x[9], market)
  }));
}

export async function getProduct(slug:string, market:Market) {
  const products=await getProducts(market);
  return products.find(p=>p.slug===slug) ?? null;
}

function formatRow(r:any, market:Market):CatalogProduct {
  return {id:r.id,publicId:r.public_id || r.id,slug:r.slug,title:r.title,description:r.description||'',
    category:r.category||'Digital Products',creatorName:r.creator_name||'DigiNanba',creatorId:r.creator_id||'DN-C-000001',
    market,currency:r.currency_code,symbol:market==='US'?'$':market==='UK'?'£':'₹',
    amountMinor:Number(r.amount_minor),price:formatMoney(Number(r.amount_minor),market)};
}
function formatMoney(minor:number, market:Market){const locale=market==='US'?'en-US':market==='UK'?'en-GB':'en-IN';const currency=market==='US'?'USD':market==='UK'?'GBP':'INR';return new Intl.NumberFormat(locale,{style:'currency',currency}).format(minor/100)}
