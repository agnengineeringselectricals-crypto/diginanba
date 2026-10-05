export type AgentCapability={
  key:string;
  label:string;
  execution:'free_internal'|'provider_required'|'approval_required'|'blocked';
  description:string;
};

export const factoryAgents:AgentCapability[]=[
  {key:'market_research',label:'Market Research Agent',execution:'free_internal',description:'Finds internal catalog coverage gaps. Public signal collection awaits an authorized, cost-classified source.'},
  {key:'opportunity_scoring',label:'Opportunity & Demand Agent',execution:'free_internal',description:'Deterministic usefulness, evidence, feasibility, discoverability and confidence scoring; no revenue forecasts.'},
  {key:'product_brief',label:'Product Brief Agent',execution:'free_internal',description:'Creates versioned structured briefs from scored opportunities.'},
  {key:'product_generation',label:'Product Creation Agent',execution:'free_internal',description:'Generates a private deterministic Markdown worksheet draft without external AI.'},
  {key:'asset_validation',label:'Asset Validation Agent',execution:'free_internal',description:'Validates encoding, format, required sections, size and SHA-256 integrity.'},
  {key:'localization',label:'Localization Agent',execution:'provider_required',description:'Requires a verified free/local localization provider; no translation is fabricated.'},
  {key:'catalog_merchandising',label:'Catalog & Merchandising Agent',execution:'free_internal',description:'Uses the existing category/subcategory taxonomy and prepares internal metadata.'},
  {key:'quality_safety',label:'Quality & Safety Agent',execution:'free_internal',description:'Runs deterministic completeness, integrity, provenance and pricing-presence gates.'},
  {key:'publishing_policy',label:'Publishing Agent',execution:'approval_required',description:'Creates a private approval request; publishing waits for a reviewed market edition and price.'},
  {key:'marketing_strategy',label:'Marketing Strategy Agent',execution:'free_internal',description:'Creates private organic-first strategy and campaign drafts with zero spend.'},
  {key:'marketing_content',label:'Content & Creative Agent',execution:'free_internal',description:'Creates private unapproved content drafts; it does not send or publish them.'},
  {key:'campaign_execution',label:'Campaign Execution Agent',execution:'blocked',description:'Blocked until an owner-authorized free integration is configured; no external communication.'},
  {key:'seo_discovery',label:'SEO & Discovery Agent',execution:'free_internal',description:'Prepares deterministic marketplace search terms without deceptive SEO or external crawls.'},
  {key:'analytics_growth',label:'Analytics & Growth Agent',execution:'provider_required',description:'No authorized traffic or sales signal source is configured; no metrics are fabricated.'},
  {key:'market_feedback',label:'Market Feedback Agent',execution:'free_internal',description:'Processes only aggregated/de-identified feedback signals recorded internally.'},
];
