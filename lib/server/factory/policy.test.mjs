import assert from 'node:assert/strict';
import test from 'node:test';
import { assessOperation } from './policy.ts';
import { buildMarkdownAsset, buildProductBrief, canRetryJob, canTransitionJob, classifyExecutionError, dependenciesReady, evaluateQuality, makeIdempotencyKey, normalizePublicSourceUrl, providerGate, publishingPolicy, retryDelaySeconds, scoreResearchOpportunity, validateMarkdownAsset } from './domain.ts';
import { isFactoryAuthorized } from './access-policy.ts';
import { deterministicProvider, ProviderRegistry, ProviderRequiredError } from './provider-registry.ts';

const base = {
  spendLimitMinor: 0,
  paidActionsAllowed: false,
  ownerApprovalRequired: true,
  freeResourceAllowed: true,
  unknownCostAction: 'block',
};

test('allows deterministic free internal work under the zero-cost policy', () => {
  assert.equal(assessOperation({ ...base, costClass: 'FREE' }).status, 'allowed');
  assert.equal(assessOperation({ ...base, costClass: 'FREE_WITH_LIMIT' }).status, 'blocked');
  assert.equal(assessOperation({ ...base, costClass: 'FREE_WITH_LIMIT', withinFreeLimit: true }).status, 'allowed');
});

test('blocks paid and unknown-cost resources even with owner approval', () => {
  assert.equal(assessOperation({ ...base, costClass: 'PAID', ownerApproved: true }).status, 'blocked');
  assert.equal(assessOperation({ ...base, costClass: 'UNKNOWN', ownerApproved: true }).status, 'blocked');
  assert.equal(assessOperation({ ...base, costClass: 'BLOCKED', ownerApproved: true }).status, 'blocked');
});

test('blocks free-tier resources if a limit is not confirmed available', () => {
  assert.equal(assessOperation({ ...base, costClass: 'FREE_WITH_LIMIT' }).status, 'blocked');
  assert.equal(assessOperation({ ...base, costClass: 'FREE_WITH_LIMIT', withinFreeLimit: true }).status, 'allowed');
});

test('requires an authorized integration and approval for external actions', () => {
  assert.equal(assessOperation({ ...base, costClass: 'FREE', externalAction: true }).status, 'blocked');
  assert.equal(assessOperation({ ...base, costClass: 'FREE', externalAction: true, authorizedIntegration: true }).status, 'approval_required');
  assert.equal(assessOperation({ ...base, costClass: 'FREE', externalAction: true, authorizedIntegration: true, ownerApproved: true }).status, 'allowed');
  assert.equal(assessOperation({ ...base, costClass: 'PAID', externalAction: true, authorizedIntegration: true, ownerApproved: true }).status, 'blocked');
  assert.equal(assessOperation({ ...base, costClass: 'UNKNOWN', externalAction: true, authorizedIntegration: true, ownerApproved: true }).status, 'blocked');
});

test('job lifecycle allows only explicit transitions and bounded transient retries', () => {
  assert.equal(canTransitionJob('queued', 'running'), true);
  assert.equal(canTransitionJob('completed', 'running'), false);
  assert.equal(canRetryJob('running', 1, 2, true), true);
  assert.equal(canRetryJob('running', 3, 2, true), false);
  assert.equal(canRetryJob('running', 1, 2, false), false);
  assert.equal(retryDelaySeconds(1), 15);
  assert.equal(retryDelaySeconds(20), 3600);
});

test('dependent jobs wait until every prerequisite is complete', () => {
  assert.equal(dependenciesReady(['completed', 'completed']), true);
  assert.equal(dependenciesReady(['completed', 'blocked']), false);
});

test('internal catalog gaps remain low-confidence rather than pretending to prove demand', () => {
  const score = scoreResearchOpportunity({ id:'1', market_code:'US', locale:'en-US', title:'Catalog gap', problem_statement:'No current product', evidence_json:[{type:'internal_catalog_gap'}], source_references_json:[] });
  assert.equal(score.priority, 'LOW');
  assert.equal(score.confidence, 0.05);
  assert.equal(score.demand, 0);
});

test('deterministic brief produces a real markdown asset that passes file checks', () => {
  const brief = buildProductBrief({ id:'op-1', market_code:'US', locale:'en-US', title:'Customer Planning Guide', problem_statement:'Small teams need a practical way to define next actions.', evidence_json:[], source_references_json:[], confidence_score:0.8 });
  const bytes = new TextEncoder().encode(buildMarkdownAsset(brief));
  const checked = validateMarkdownAsset(bytes, 'text/markdown', 'guide.md');
  assert.equal(checked.valid, true);
  assert.equal(validateMarkdownAsset(Uint8Array.from([0xff,0xfe]),'text/markdown','guide.md').valid,false);
  assert.equal(validateMarkdownAsset(bytes,'text/markdown','../guide.md').valid,false);
  assert.equal(evaluateQuality(brief, checked).status, 'passed');
});

test('publishing and providers fail closed without approval or free authorized provider', () => {
  assert.equal(providerGate('PAID', true, true).status, 'blocked');
  assert.equal(providerGate('UNKNOWN', true, true).status, 'blocked');
  assert.equal(providerGate('FREE', false, false).status, 'blocked');
  assert.equal(publishingPolicy({qualityPassed:false,approvalRequired:true,approved:false,productStatus:'draft'}).status,'blocked');
  assert.equal(publishingPolicy({qualityPassed:true,approvalRequired:true,approved:false,productStatus:'draft'}).status,'approval_required');
  assert.equal(publishingPolicy({qualityPassed:true,approvalRequired:true,approved:true,productStatus:'draft'}).status,'allowed');
  assert.equal(publishingPolicy({qualityPassed:true,approvalRequired:false,approved:false,productStatus:'draft'}).status,'approval_required');
});

test('resource decisions enforce admin boundaries and keep credentials out of references', () => {
  assert.equal(isFactoryAuthorized(['Read-Only Analyst'],'view'),true);
  assert.equal(isFactoryAuthorized(['Read-Only Analyst'],'manage'),false);
  assert.equal(isFactoryAuthorized(['Customer'],'view'),false);
  assert.equal(isFactoryAuthorized(['Creator'],'view'),false);
  assert.equal(isFactoryAuthorized(['Seller'],'manage'),false);
  for (const role of ['Super Admin','Operations Admin','AI Factory Manager']) {
    assert.equal(isFactoryAuthorized([role],'view'),true);
    assert.equal(isFactoryAuthorized([role],'manage'),true);
  }
  assert.equal(normalizePublicSourceUrl('https://research.example/path?session=secret#fragment'),'https://research.example/path');
  assert.equal(normalizePublicSourceUrl('http://research.example'),null);
  assert.equal(normalizePublicSourceUrl('https://user:pass@research.example'),null);
  assert.equal(normalizePublicSourceUrl('https://192.168.1.10/admin'),null);
});

test('provider registry only executes declared local capabilities and idempotency keys are stable', () => {
  const registry=new ProviderRegistry();
  registry.register(deterministicProvider);
  const brief={id:'1',market_code:'US',locale:'en-US',title:'Good title',problem_statement:'Documented problem statement.',evidence_json:[],source_references_json:[]};
  assert.ok(registry.execute('diginanba-local-deterministic','product_brief',brief).title);
  assert.throws(()=>registry.execute('commercial-cloud-ai','product_brief',brief),ProviderRequiredError);
  assert.throws(()=>registry.execute('diginanba-local-deterministic','pdf_guide',brief),ProviderRequiredError);
  assert.equal(makeIdempotencyKey('research','same-input'),makeIdempotencyKey('research','same-input'));
  assert.notEqual(makeIdempotencyKey('factory','x'.repeat(200)+'first'),makeIdempotencyKey('factory','x'.repeat(200)+'second'));
});

test('execution errors retry only when explicitly transient and remain bounded', () => {
  assert.equal(classifyExecutionError(Object.assign(new Error('deadlock'),{code:'40P01'})).retryable,true);
  assert.equal(classifyExecutionError(Object.assign(new Error('invalid input'),{code:'22023'})).retryable,false);
  assert.equal(classifyExecutionError(Object.assign(new Error('permanent'),{retryable:false})).retryable,false);
  assert.equal(canRetryJob('running',1,2,classifyExecutionError(Object.assign(new Error('deadlock'),{code:'40P01'})).retryable),true);
  assert.equal(canRetryJob('running',3,2,true),false);
});
