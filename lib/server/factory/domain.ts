import type { CostClass, OperationAssessment } from './policy.ts';

export type JobStatus = 'queued' | 'waiting_dependency' | 'running' | 'retry_wait' | 'completed' | 'failed' | 'blocked' | 'provider_required' | 'approval_required' | 'cancelled';

const terminalStates = new Set<JobStatus>(['completed', 'failed', 'blocked', 'provider_required', 'approval_required', 'cancelled']);

export function isTerminalJobStatus(status: JobStatus) {
  return terminalStates.has(status);
}

export function canRetryJob(status: JobStatus, retryCount: number, maxRetries: number, retryable: boolean) {
  return retryable && status === 'running' && retryCount <= maxRetries;
}

export function retryDelaySeconds(retryCount: number) {
  return Math.min(3600, Math.max(1, 15 * 2 ** Math.max(0, retryCount - 1)));
}

export function dependenciesReady(statuses: JobStatus[]) {
  return statuses.every((status) => status === 'completed');
}

export type ResearchOpportunity = {
  id: string;
  market_code: string;
  locale: string;
  title: string;
  problem_statement: string;
  source_summary: string | null;
  evidence_json: unknown;
  source_references_json: unknown;
  confidence_score?: number;
  category_id?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  subcategory_id?: string | null;
  subcategory_name?: string | null;
  subcategory_slug?: string | null;
};

export function scoreResearchOpportunity(opportunity: ResearchOpportunity) {
  const evidence = Array.isArray(opportunity.evidence_json) ? opportunity.evidence_json : [];
  const refs = Array.isArray(opportunity.source_references_json) ? opportunity.source_references_json : [];
  const internalOnly = evidence.length > 0 && evidence.every((entry: any) => entry?.type === 'internal_catalog_gap');
  const distinctSources = new Set(refs.map((entry: any) => {
    if (typeof entry?.source === 'string') return entry.source;
    if (typeof entry?.url !== 'string') return '';
    try { return new URL(entry.url).hostname; } catch { return ''; }
  }).filter(Boolean));
  const demand = internalOnly ? 0 : Math.min(100, distinctSources.size * 20);
  const usefulness = Math.min(75, 25 + Math.min(evidence.length, 5) * 10);
  const feasibility = opportunity.category_id ? 75 : 40;
  const organicDiscoverability = Math.min(70, 20 + distinctSources.size * 10);
  const score = Math.round((demand * 0.3 + usefulness * 0.2 + feasibility * 0.2 + organicDiscoverability * 0.15 + 40 * 0.15) * 100) / 100;
  const confidence = Math.min(0.95, Math.max(0.05, distinctSources.size * 0.18 + (internalOnly ? 0 : 0)));
  const priority = score >= 70 && confidence >= 0.65 ? 'HIGH' : score >= 50 && confidence >= 0.4 ? 'MEDIUM' : 'LOW';
  return { score, confidence, priority, demand, usefulness, feasibility, organicDiscoverability, internalOnly };
}

export function buildProductBrief(opportunity: ResearchOpportunity) {
  return {
    brief_version: 1,
    title: opportunity.title,
    customer_problem: opportunity.problem_statement,
    target_audience: 'To be confirmed from evidence before product publication.',
    category: opportunity.category_name ? { id: opportunity.category_id, name: opportunity.category_name, slug: opportunity.category_slug } : null,
    subcategory: opportunity.subcategory_name ? { id: opportunity.subcategory_id, name: opportunity.subcategory_name, slug: opportunity.subcategory_slug } : null,
    format: 'markdown_guide',
    contents: ['Outcome and scope', 'Current situation', 'Audience and needs', 'Action plan', 'Review and next steps'],
    features: ['Editable prompts', 'Practical step-by-step worksheet', 'Progress review section'],
    expected_outcome: 'A structured starting point for addressing the documented problem; outcome claims require validation.',
    market: opportunity.market_code,
    locale: opportunity.locale,
    pricing_suggestion: null,
    quality_requirements: ['All sections present', 'No unsupported claims', 'Evidence and provenance retained'],
    localization_requirements: ['Review terminology and regional conventions before another locale is approved'],
    evidence_confidence: opportunity.confidence_score ?? 0,
    provenance: { source_opportunity_id: opportunity.id, method: 'deterministic_template_v1', generated_at: new Date().toISOString() },
  };
}

export function buildMarkdownAsset(brief: ReturnType<typeof buildProductBrief>) {
  const section = (title: string) => `## ${title}\n\n- What do you know today?\n- What evidence supports this?\n- What is the next practical action?\n`;
  return [
    `# ${brief.title}`,
    '',
    `> Draft ${brief.format.replaceAll('_', ' ')} created from a reviewed product brief. Validate the market need and all claims before publication.`,
    '',
    '## Customer problem',
    '',
    brief.customer_problem,
    '',
    '## How to use this guide',
    '',
    'Work through each section using your own context and evidence. This guide does not guarantee a particular business or financial result.',
    '',
    section('Outcome and scope'),
    section('Current situation'),
    section('Audience and needs'),
    section('Action plan'),
    section('Review and next steps'),
  ].join('\n');
}

export function validateMarkdownAsset(bytes: Uint8Array, mimeType: string, fileName: string) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const requiredHeadings = ['# ', '## Customer problem', '## How to use this guide', '## Outcome and scope', '## Action plan'];
  const missingHeadings = requiredHeadings.filter((heading) => !text.includes(heading));
  const valid = mimeType === 'text/markdown' && fileName.toLowerCase().endsWith('.md') && bytes.byteLength > 100 && bytes.byteLength <= 2_000_000 && missingHeadings.length === 0;
  return { valid, sizeBytes: bytes.byteLength, missingHeadings, reason: valid ? null : 'Asset format, size, encoding, or required sections failed validation.' };
}

export function evaluateQuality(brief: ReturnType<typeof buildProductBrief>, assetValidation: ReturnType<typeof validateMarkdownAsset>) {
  const findings: string[] = [];
  if (!assetValidation.valid) findings.push('Asset validation did not pass.');
  if (brief.title.trim().length < 5) findings.push('Product title is too short.');
  if (!brief.customer_problem.trim()) findings.push('Customer problem is missing.');
  if (!brief.provenance.source_opportunity_id) findings.push('Opportunity provenance is missing.');
  if (brief.pricing_suggestion !== null) findings.push('Price suggestion requires a separately verified pricing source.');
  const passed = findings.length === 0;
  return { status: passed ? 'passed' as const : 'failed' as const, score: passed ? 100 : 0, findings };
}

export function publishingPolicy(input: { qualityPassed: boolean; approvalRequired: boolean; approved: boolean; productStatus: string }) : OperationAssessment {
  if (!input.qualityPassed) return { status: 'blocked', reason: 'Required quality checks must pass before publishing.' };
  if (input.productStatus !== 'draft') return { status: 'blocked', reason: 'Only draft products may enter the publishing workflow.' };
  if (input.approvalRequired && !input.approved) return { status: 'approval_required', reason: 'Public catalog publishing requires an authorized human approval.' };
  return { status: 'allowed', reason: 'Quality and publication policy checks passed.' };
}

export function providerGate(costClass: CostClass, enabled: boolean, automaticAllowed: boolean): OperationAssessment {
  if (!enabled || !automaticAllowed) return { status: 'blocked', reason: 'Provider is disabled or not authorized for automatic use.' };
  if (costClass === 'PAID') return { status: 'blocked', reason: 'Paid providers are blocked by the ₹0 spend policy.' };
  if (costClass === 'UNKNOWN') return { status: 'blocked', reason: 'Provider cost is unknown; fail closed.' };
  if (costClass === 'BLOCKED') return { status: 'blocked', reason: 'Provider is blocked by policy.' };
  if (costClass === 'FREE_WITH_LIMIT') return { status: 'allowed', reason: 'Free-tier execution requires an atomic quota reservation.' };
  return { status: 'allowed', reason: 'Enabled local free provider.' };
}

const transitions: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'blocked', 'provider_required', 'approval_required', 'cancelled'],
  waiting_dependency: ['queued', 'cancelled'],
  running: ['completed', 'retry_wait', 'failed', 'blocked', 'provider_required', 'approval_required'],
  retry_wait: ['running', 'cancelled'],
  completed: [], failed: [], blocked: [], provider_required: [], approval_required: [], cancelled: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus) {
  return transitions[from].includes(to);
}

export function makeIdempotencyKey(namespace:string,key:string) {
  const normalized=`${namespace}:${key}`.trim().replace(/[^a-zA-Z0-9:._-]/g,'_');
  return normalized.length<=150?normalized:normalized.slice(0,130)+':'+Array.from(new TextEncoder().encode(normalized)).slice(-12).map((byte)=>byte.toString(16).padStart(2,'0')).join('');
}

export function normalizePublicSourceUrl(raw:string) {
  try {
    const url=new URL(raw);
    const host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||host==='localhost'||host.endsWith('.localhost')||host==='::1'||/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    url.search='';url.hash='';
    return url.toString();
  }catch{return null;}
}

export function scheduleIntervalMs(expression:string,timezone:string) {
  if(timezone!=='UTC') return null;
  if(expression==='@hourly') return 60*60*1000;
  if(expression==='@daily') return 24*60*60*1000;
  if(expression==='@weekly') return 7*24*60*60*1000;
  return null;
}
