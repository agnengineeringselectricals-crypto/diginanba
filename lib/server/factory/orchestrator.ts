import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db } from '../../db';
import { assessOperation, type CostClass, type OperationAssessment } from './policy.ts';
import { canRetryJob, classifyExecutionError, makeIdempotencyKey, normalizePublicSourceUrl, providerGate, publishingPolicy, retryDelaySeconds, scheduleIntervalMs, type ResearchOpportunity, type buildProductBrief } from './domain.ts';
import { factoryAgents } from './agents.ts';
import { providers } from './provider-registry.ts';

const LOCAL_PROVIDER = 'diginanba-local-deterministic';
const MAX_JOBS_PER_REQUEST = 12;
const MAX_SCHEDULES_PER_REQUEST = 5;

type AgentJob = {
  id: string; agent_run_id: string; parent_job_id: string | null; job_type: string; status: string;
  cost_class: CostClass; input_json: Record<string, any>; output_json: Record<string, any> | null;
  idempotency_key: string; retry_count: number; max_retries: number;
};
type ChildJob = { type: string; input: Record<string, unknown>; key: string; parentId: string; costClass?: CostClass; terminal?: 'provider_required' | 'approval_required' | 'blocked'; reason?: string };

function safeIdempotencyKey(value: string) {
  return makeIdempotencyKey('factory',value);
}

async function addEvent(client: PoolClient, runId: string, eventType: string, message: string, data: unknown = {}, level = 'info') {
  await client.query('INSERT INTO agent_events(agent_run_id,event_type,level,message,data_json) VALUES($1,$2,$3,$4,$5)', [runId,eventType,level,message,data]);
}

async function enqueueChild(client: PoolClient, runId: string, child: ChildJob) {
  const status = child.terminal ?? 'queued';
  const output = child.terminal ? { status: child.terminal, reason: child.reason } : null;
  const result = await client.query<{ id: string }>(
    `INSERT INTO agent_jobs(agent_run_id,parent_job_id,job_type,status,cost_class,input_json,output_json,idempotency_key,completed_at,error_code,error_message)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $4 IN ('blocked','provider_required','approval_required','cancelled','completed','failed') THEN now() ELSE NULL END,$9,$10) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [runId,child.parentId,child.type,status,child.costClass ?? 'FREE',child.input,output,safeIdempotencyKey(`${runId}:${child.type}:${child.key}`),child.terminal?`POLICY_${child.terminal.toUpperCase()}`:null,child.terminal?child.reason??`${child.type} is not executable under current configuration.`:null],
  );
  if (result.rowCount && child.terminal) await addEvent(client,runId,`${child.type}_${child.terminal}`,child.reason ?? `${child.type} cannot execute under current policy.`,{jobId:result.rows[0].id,reason:child.reason},'warning');
  return result.rows[0]?.id ?? null;
}

export async function createResearchRun(userId: string, idempotencyKey: string, scope:{marketCode?:string;categorySlug?:string} = {}) {
  const client = await db.connect();
  const key = safeIdempotencyKey(`manual-market-research:${idempotencyKey}`);
  try {
    await client.query('BEGIN');
    const prior = await client.query<{ agent_run_id: string }>('SELECT agent_run_id FROM agent_jobs WHERE idempotency_key=$1', [key]);
    if (prior.rowCount) {
      await client.query('COMMIT');
      return prior.rows[0].agent_run_id;
    }
    const run = await client.query<{ id: string }>(
      `INSERT INTO agent_runs(agent_type,status,input_json,provenance_json,started_at)
       VALUES('market_research','running',$1,$2,now()) RETURNING id`,
      [{ requestedBy: userId, scope: 'enabled markets and catalog coverage only', marketCode:scope.marketCode, categorySlug:scope.categorySlug, provider: LOCAL_PROVIDER },{version:1,provider:LOCAL_PROVIDER,method:'deterministic_internal_catalog_inventory',requestedBy:userId,requestedAt:new Date().toISOString()}],
    );
    await client.query(
      `INSERT INTO agent_jobs(agent_run_id,job_type,status,cost_class,input_json,idempotency_key)
       VALUES($1,'market_research','queued','FREE',$2,$3)`,
      [run.rows[0].id,{providerKey:LOCAL_PROVIDER,marketCode:scope.marketCode,categorySlug:scope.categorySlug},key],
    );
    await addEvent(client,run.rows[0].id,'run_queued','Private deterministic catalog-coverage research run queued.',{requestedBy:userId});
    await client.query('COMMIT');
    return run.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string })?.code === '23505') {
      const prior = await db.query<{ agent_run_id: string }>('SELECT agent_run_id FROM agent_jobs WHERE idempotency_key=$1', [key]);
      if (prior.rowCount) return prior.rows[0].agent_run_id;
    }
    throw error;
  } finally { client.release(); }
}

export async function createOpportunityScoringRun(userId:string,idempotencyKey:string,input:{marketCode:string;title:string;problemStatement:string;categorySlug?:string;subcategorySlug?:string;sourceSummary:string;sources:Array<{url:string;summary:string}>}) {
  const client=await db.connect();
  const key=safeIdempotencyKey(`manual-opportunity:${idempotencyKey}`);
  try {
    await client.query('BEGIN');
    const prior=await client.query<{agent_run_id:string}>('SELECT agent_run_id FROM agent_jobs WHERE idempotency_key=$1',[key]);
    if(prior.rowCount){await client.query('COMMIT');return prior.rows[0].agent_run_id;}
    const market=await client.query<{locale:string}>('SELECT locale FROM markets WHERE code=$1 AND enabled=true',[input.marketCode]);
    if(!market.rowCount) throw Object.assign(new Error('Selected market is not enabled.'),{code:'MARKET_UNAVAILABLE',retryable:false});
    let categoryId:string|null=null,subcategoryId:string|null=null;
    if(input.categorySlug){
      const category=await client.query<{id:string}>('SELECT id FROM categories WHERE slug=$1 AND enabled=true',[input.categorySlug]);
      if(!category.rowCount) throw Object.assign(new Error('Selected category is unavailable.'),{code:'CATEGORY_UNAVAILABLE',retryable:false});
      categoryId=category.rows[0].id;
      if(input.subcategorySlug){
        const sub=await client.query<{id:string}>('SELECT id FROM subcategories WHERE category_id=$1 AND slug=$2 AND enabled=true',[categoryId,input.subcategorySlug]);
        if(!sub.rowCount) throw Object.assign(new Error('Selected subcategory does not belong to the category.'),{code:'SUBCATEGORY_UNAVAILABLE',retryable:false});
        subcategoryId=sub.rows[0].id;
      }
    }
    const sourceReferences=input.sources.map((source)=>{
      const normalizedUrl=normalizePublicSourceUrl(source.url);
      if(!normalizedUrl) throw Object.assign(new Error('Sources must be public HTTPS URLs without credentials or private-network hosts.'),{code:'SOURCE_URL_INVALID',retryable:false});
      const url=new URL(normalizedUrl);
      return {source:url.hostname.toLowerCase(),url:normalizedUrl,summary:source.summary,submitted_by:userId,submitted_at:new Date().toISOString()};
    });
    const evidence=sourceReferences.map((source)=>({type:'operator_submitted_public_reference',source:source.source,summary:source.summary}));
    const opportunity=await client.query<{id:string}>(
      `INSERT INTO research_opportunities(market_code,title,problem_statement,evidence_json,status,source_summary,locale,source_references_json,provenance_json,opportunity_key,category_id,subcategory_id)
       VALUES($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [input.marketCode,input.title,input.problemStatement,JSON.stringify(evidence),input.sourceSummary,market.rows[0].locale,JSON.stringify(sourceReferences),{agent:'operator_evidence_intake',requested_by:userId,method:'admin_submitted_public_source_references'},key,categoryId,subcategoryId],
    );
    const run=await client.query<{id:string}>(`INSERT INTO agent_runs(agent_type,status,input_json,provenance_json,started_at) VALUES('opportunity_scoring','running',$1,$2,now()) RETURNING id`,[{requestedBy:userId,opportunityId:opportunity.rows[0].id,provider:LOCAL_PROVIDER},{version:1,provider:LOCAL_PROVIDER,method:'deterministic_evidence_scoring',requestedBy:userId,requestedAt:new Date().toISOString()}]);
    await client.query(`INSERT INTO agent_jobs(agent_run_id,job_type,status,cost_class,input_json,idempotency_key) VALUES($1,'opportunity_scoring','queued','FREE',$2,$3)`,[run.rows[0].id,{opportunityId:opportunity.rows[0].id,providerKey:LOCAL_PROVIDER},key]);
    await addEvent(client,run.rows[0].id,'evidence_intake','Operator-submitted public source references were recorded for deterministic scoring.',{opportunityId:opportunity.rows[0].id,referenceCount:sourceReferences.length});
    await client.query('COMMIT');
    return run.rows[0].id;
  }catch(error){
    await client.query('ROLLBACK');
    if((error as {code?:string})?.code==='23505'){
      const prior=await db.query<{agent_run_id:string}>('SELECT agent_run_id FROM agent_jobs WHERE idempotency_key=$1',[key]);
      if(prior.rowCount) return prior.rows[0].agent_run_id;
    }
    throw error;
  }
  finally{client.release();}
}

async function getProviderAssessment(client: PoolClient, job: AgentJob): Promise<OperationAssessment> {
  const providerKey = String(job.input_json?.providerKey ?? '');
  if (!providerKey) return { status:'blocked', reason:'No cost-classified provider is assigned.' };
  const result = await client.query<any>(
    `SELECT p.cost_class,p.enabled,p.automatic_allowed,p.max_runs_per_day,
            f.max_spend_minor,f.paid_actions_allowed,f.owner_approval_required,f.free_resource_allowed,f.unknown_cost_action
     FROM agent_resource_providers p
     LEFT JOIN LATERAL (
       SELECT * FROM agent_financial_policies WHERE policy_status='active' AND agent_type IN ('*',$2)
       ORDER BY (agent_type=$2) DESC LIMIT 1
     ) f ON true WHERE p.provider_key=$1 LIMIT 1`, [providerKey,job.job_type],
  );
  const provider = result.rows[0];
  if (!provider) return { status:'blocked', reason:'Provider is not registered; unknown-cost resources fail closed.' };
  if (!provider.enabled || !provider.automatic_allowed || provider.max_spend_minor === null || provider.paid_actions_allowed !== false || provider.owner_approval_required !== true || provider.unknown_cost_action !== 'block') return { status:'blocked', reason:'Provider or zero-cost policy is unavailable.' };
  const gate = providerGate(provider.cost_class as CostClass,provider.enabled,provider.automatic_allowed);
  if (gate.status !== 'allowed') return gate;
  let withinFreeLimit = false;
  if (provider.cost_class === 'FREE_WITH_LIMIT') {
    if (!provider.free_resource_allowed || !provider.max_runs_per_day) return {status:'blocked',reason:'Free-tier limit is missing or disabled.'};
    const usage = await client.query(
      `INSERT INTO agent_resource_usage(provider_id,usage_date,used_runs)
       SELECT id,(now() AT TIME ZONE 'UTC')::date,1 FROM agent_resource_providers WHERE provider_key=$1
       ON CONFLICT(provider_id,usage_date) DO UPDATE SET used_runs=agent_resource_usage.used_runs+1,updated_at=now()
       WHERE agent_resource_usage.used_runs < $2 RETURNING used_runs`,[providerKey,provider.max_runs_per_day],
    );
    if (!usage.rowCount) return { status:'blocked', reason:'The configured free-tier quota is exhausted.' };
    withinFreeLimit=true;
  }
  const costRank:Record<CostClass,number>={FREE:0,FREE_WITH_LIMIT:1,UNKNOWN:2,PAID:3,BLOCKED:4};
  const effectiveCostClass=costRank[job.cost_class]>=costRank[provider.cost_class as CostClass]?job.cost_class:provider.cost_class as CostClass;
  const policy = assessOperation({
    costClass:effectiveCostClass,
    spendLimitMinor:Number(provider.max_spend_minor),
    paidActionsAllowed:provider.paid_actions_allowed,
    ownerApprovalRequired:provider.owner_approval_required,
    freeResourceAllowed:provider.free_resource_allowed,
    unknownCostAction:provider.unknown_cost_action,
    withinFreeLimit,
  });
  if (policy.status !== 'allowed') return policy;
  return policy;
}

async function claimNextJob(runId: string): Promise<AgentJob | null> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const stale=await client.query<{id:string;retry_count:number;max_retries:number}>(
      `UPDATE agent_jobs SET status=CASE WHEN retry_count<=max_retries THEN 'retry_wait' ELSE 'failed' END,
       available_at=now(),locked_at=NULL,error_code='STALE_EXECUTION',error_message='A previous worker stopped before committing its result.',completed_at=CASE WHEN retry_count<=max_retries THEN NULL ELSE now() END,updated_at=now()
       WHERE agent_run_id=$1 AND status='running' AND locked_at<now()-interval '5 minutes' RETURNING id,retry_count,max_retries`,[runId],
    );
    for(const item of stale.rows) await addEvent(client,runId,'stale_job_recovered','Stale agent job was safely returned to retry or marked failed.',item,'warning');
    const result = await client.query<AgentJob>(
      `WITH candidate AS (
        SELECT j.id FROM agent_jobs j
        WHERE j.agent_run_id=$1 AND j.status IN ('queued','retry_wait') AND j.available_at<=now()
          AND (j.parent_job_id IS NULL OR EXISTS(SELECT 1 FROM agent_jobs parent WHERE parent.id=j.parent_job_id AND parent.status='completed'))
        ORDER BY j.created_at,j.id FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE agent_jobs j SET status='running',retry_count=j.retry_count+1,started_at=COALESCE(j.started_at,now()),locked_at=now(),completed_at=NULL,error_code=NULL,error_message=NULL,updated_at=now()
       FROM candidate WHERE j.id=candidate.id RETURNING j.*`,[runId],
    );
    await client.query('COMMIT');
    return result.rows[0] ?? null;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function finishJob(job: AgentJob, status: string, output: unknown, children: ChildJob[] = [], error?: { code: string; message: string; retryable: boolean }, terminalStatus?:string) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const retry = error ? canRetryJob('running',job.retry_count,job.max_retries,error.retryable) : false;
    const nextStatus = terminalStatus ?? (retry ? 'retry_wait' : error ? 'failed' : status);
    const retryAt = retry ? new Date(Date.now()+retryDelaySeconds(job.retry_count)*1000) : null;
    await client.query(
      `UPDATE agent_jobs SET status=$2,output_json=$3,error_code=$4,error_message=$5,available_at=COALESCE($6,available_at),completed_at=CASE WHEN $2 IN ('completed','failed','blocked','provider_required','approval_required','cancelled') THEN now() ELSE completed_at END,locked_at=NULL,updated_at=now() WHERE id=$1`,
      [job.id,nextStatus,output ?? null,error?.code ?? null,error?.message ?? null,retryAt],
    );
    if(job.input_json.productJobId&&['product_generation','asset_validation'].includes(job.job_type)&&['failed','blocked','provider_required','approval_required'].includes(nextStatus)){
      const productJobStatus=nextStatus==='approval_required'?'awaiting_review':nextStatus;
      await client.query(`UPDATE product_jobs SET status=$2,error_message=$3,updated_at=now() WHERE id=$1 AND status IN ('queued','running')`,[job.input_json.productJobId,productJobStatus,error?.message??(output as {reason?:string}|null)?.reason??'Factory product stage did not complete.']);
    }
    const eventLevel=retry?'warning':nextStatus==='failed'?'error':error?'warning':'info';
    await addEvent(client,job.agent_run_id,retry?'job_retry_scheduled':`${job.job_type}_${nextStatus}`,error?.message ?? `${job.job_type} ${nextStatus}.`,{jobId:job.id,output},eventLevel);
    for (const child of children) await enqueueChild(client,job.agent_run_id,child);
    await client.query('COMMIT');
    return nextStatus;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function failPolicy(job: AgentJob, assessment: OperationAssessment) {
  const status=assessment.status==='approval_required'?'approval_required':'blocked';
  await finishJob(job,status,{reason:assessment.reason},[],{code:`POLICY_${status.toUpperCase()}`,message:assessment.reason,retryable:false},status);
}

async function findCatalogGaps(client: PoolClient, runId: string, jobId: string, marketCode?: string, categorySlug?:string) {
  const { rows } = await client.query<any>(
    `SELECT m.code market_code,m.locale,c.id category_id,c.slug category_slug,c.name category_name,
            s.id subcategory_id,s.slug subcategory_slug,s.name subcategory_name
     FROM markets m CROSS JOIN categories c LEFT JOIN LATERAL (SELECT id,slug,name FROM subcategories WHERE category_id=c.id AND enabled=true ORDER BY sort_order,id LIMIT 1) s ON true
     WHERE m.enabled=true AND c.enabled=true AND ($1::text IS NULL OR m.code=$1)
       AND ($2::text IS NULL OR c.slug=$2)
       AND NOT EXISTS (
         SELECT 1 FROM products p JOIN product_editions pe ON pe.product_id=p.id
         WHERE p.category_id=c.id AND p.status='published' AND pe.market_code=m.code AND pe.status='published'
       )
      ORDER BY m.code,c.sort_order,s.sort_order NULLS FIRST LIMIT 60`,[marketCode ?? null,categorySlug ?? null],
  );
  const candidates: string[] = [];
  for (const row of rows) {
    const key = `catalog-gap-v1:${row.market_code}:${row.category_slug}`;
    const evidence = [{type:'internal_catalog_gap',market:row.market_code,category:row.category_slug,published_edition_count:0,observed_at:new Date().toISOString(),note:'Internal catalog coverage only; this is not evidence of customer demand.'}];
    const refs = [{type:'internal_database_query',source:'diginanba_catalog_inventory',observed_at:new Date().toISOString()}];
    const title = `Catalog coverage review: ${row.category_name} (${row.market_code})`;
    const problem = `There are currently no published product editions in ${row.category_name} for the ${row.market_code} market. This internal inventory gap does not establish customer demand.`;
    const created = await client.query<{id:string}>(
      `INSERT INTO research_opportunities(market_code,title,problem_statement,evidence_json,status,source_summary,locale,source_references_json,provenance_json,opportunity_key,category_id,subcategory_id,confidence_score,priority)
       VALUES($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,$11,0.05,'LOW')
       ON CONFLICT(opportunity_key) WHERE opportunity_key IS NOT NULL DO NOTHING RETURNING id`,
       [row.market_code,title,problem,JSON.stringify(evidence),`Internal catalog inventory detected no published editions in ${row.category_name}.`,row.locale,JSON.stringify(refs),{agent:'market_research',provider:LOCAL_PROVIDER,run_id:runId,job_id:jobId},key,row.category_id,row.subcategory_id],
    );
    let opportunityId = created.rows[0]?.id;
    if (!opportunityId) {
      const existing = await client.query<{id:string}>(`SELECT id FROM research_opportunities WHERE opportunity_key=$1`,[key]);
      opportunityId = existing.rows[0]?.id;
    }
    if (opportunityId) candidates.push(opportunityId);
  }
  return { output:{candidateCount:candidates.length,scope:'internal catalog coverage; no external web or customer-demand claims',opportunityIds:candidates}, children:candidates.map((id)=>({type:'opportunity_scoring',input:{opportunityId:id,providerKey:LOCAL_PROVIDER},key:id,parentId:jobId})) as ChildJob[] };
}

async function handleScoring(client: PoolClient, job: AgentJob) {
  const id=String(job.input_json.opportunityId??'');
  const query=await client.query<any>(
    `SELECT o.*,c.name category_name,c.slug category_slug,s.name subcategory_name,s.slug subcategory_slug
     FROM research_opportunities o LEFT JOIN categories c ON c.id=o.category_id
     LEFT JOIN subcategories s ON s.id=o.subcategory_id WHERE o.id=$1`,[id],
  );
  const opportunity=query.rows[0];
  if (!opportunity) throw Object.assign(new Error('Research opportunity not found.'),{code:'OPPORTUNITY_NOT_FOUND',retryable:false});
  const scored=providers.execute<typeof opportunity,ReturnType<typeof import('./domain').scoreResearchOpportunity>>(LOCAL_PROVIDER,'opportunity_score',{...opportunity,confidence_score:Number(opportunity.confidence_score)} as ResearchOpportunity);
  await client.query(
    `UPDATE research_opportunities SET opportunity_score=$2,confidence_score=$3,priority=$4,status=CASE WHEN $4 IN ('HIGH','MEDIUM') THEN 'qualified' ELSE 'new' END,updated_at=now() WHERE id=$1`,
    [id,scored.score,scored.confidence,scored.priority],
  );
  const children:ChildJob[]=[];
  // A catalog gap can start a private review draft at low confidence; this is
  // never presented as customer-demand evidence and cannot auto-publish.
  children.push({type:'product_brief',input:{opportunityId:id,providerKey:LOCAL_PROVIDER},key:id,parentId:job.id});
  return {output:{opportunityId:id,...scored},children};
}

async function handleBrief(client: PoolClient, job: AgentJob, runId: string) {
  const id=String(job.input_json.opportunityId??'');
  const result=await client.query<any>(`SELECT o.*,c.name category_name,c.slug category_slug,s.name subcategory_name,s.slug subcategory_slug FROM research_opportunities o LEFT JOIN categories c ON c.id=o.category_id LEFT JOIN subcategories s ON s.id=o.subcategory_id WHERE o.id=$1`,[id]);
  const opportunity=result.rows[0];
  if(!opportunity) throw Object.assign(new Error('Research opportunity not found.'),{code:'OPPORTUNITY_NOT_FOUND',retryable:false});
  const brief=providers.execute<typeof opportunity,ReturnType<typeof import('./domain').buildProductBrief>>(LOCAL_PROVIDER,'product_brief',{...opportunity,confidence_score:Number(opportunity.confidence_score)} as ResearchOpportunity);
  const key=`factory-brief:${id}:v1`;
  const inserted=await client.query<{id:string}>(
    `INSERT INTO product_jobs(opportunity_id,job_type,status,brief_json,agent_job_id,idempotency_key,brief_version)
     VALUES($1,'product_brief','queued',$2,$3,$4,1) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [id,brief,job.id,key],
  );
  let productJobId=inserted.rows[0]?.id;
  if(!productJobId) productJobId=(await client.query<{id:string}>('SELECT id FROM product_jobs WHERE idempotency_key=$1',[key])).rows[0]?.id;
  if(!productJobId) throw new Error('Could not persist product brief job.');
  await client.query(`UPDATE product_jobs SET status='queued',updated_at=now() WHERE id=$1 AND status='awaiting_review'`,[productJobId]);
  return {output:{productJobId,brief},children:[{type:'product_generation',input:{productJobId,providerKey:LOCAL_PROVIDER},key:productJobId,parentId:job.id}] as ChildJob[]};
}

function toSlug(value:string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'digital-guide';
}

async function handleGeneration(client: PoolClient, job: AgentJob, runId: string) {
  const productJobId=String(job.input_json.productJobId??'');
  const result=await client.query<any>(`SELECT pj.*,o.market_code,o.locale,o.category_id,o.subcategory_id,o.id opportunity_id FROM product_jobs pj JOIN research_opportunities o ON o.id=pj.opportunity_id WHERE pj.id=$1`,[productJobId]);
  const productJob=result.rows[0];
  if(!productJob) throw Object.assign(new Error('Product brief job not found.'),{code:'PRODUCT_JOB_NOT_FOUND',retryable:false});
  const brief=productJob.brief_json as ReturnType<typeof buildProductBrief>;
  const title=String(brief.title);
  const slug=`${toSlug(title)}-${String(productJob.opportunity_id).slice(0,8)}`;
  const product=await client.query<{id:string}>(
    `INSERT INTO products(category_id,subcategory_id,slug,title,description,product_type,owner_type,status,search_terms,metadata_json)
     VALUES($1,$2,$3,$4,$5,'guide','platform','draft',$6,$7) ON CONFLICT(slug) DO NOTHING RETURNING id`,
    [productJob.category_id,productJob.subcategory_id,slug,title,String(brief.customer_problem),['guide',...title.toLowerCase().split(/\W+/).filter((word:string)=>word.length>3)],{source:'autonomous_product_factory',provenance:brief.provenance,publication_status:'draft'}],
  );
  let productId=product.rows[0]?.id;
  if(!productId) productId=(await client.query<{id:string}>('SELECT id FROM products WHERE slug=$1',[slug])).rows[0]?.id;
  if(!productId) throw new Error('Could not create deterministic product draft.');
  const bytes=Buffer.from(providers.execute<typeof brief,string>(LOCAL_PROVIDER,'markdown_guide',brief),'utf8');
  const checksum=createHash('sha256').update(bytes).digest('hex');
  const assetId=randomUUID();
  await client.query(
    `INSERT INTO product_assets(id,product_job_id,product_id,asset_type,storage_key,file_name,mime_type,version,metadata_json,status,asset_bytes,size_bytes,checksum_sha256,idempotency_key)
     VALUES($1,$2,$3,'guide',$4,$5,'text/markdown',$6,$7,'pending',$8,$9,$10,$11) ON CONFLICT(idempotency_key) DO NOTHING`,
    [assetId,productJobId,productId,`postgres:product_assets/${assetId}`,`${slug}.md`,Number(brief.brief_version),{generation_method:'deterministic_template_v1',provider:LOCAL_PROVIDER,run_id:runId,created_at:new Date().toISOString(),source_brief:productJobId,source_opportunity_id:productJob.opportunity_id,evidence_confidence:Number(brief.evidence_confidence),provenance:brief.provenance,encoding:'utf-8'},bytes,bytes.length,checksum,`asset:${productJobId}:v${Number(brief.brief_version)}`],
  );
  const assetKey=`asset:${productJobId}:v${Number(brief.brief_version)}`;
  const storedAsset=await client.query<{id:string}>('SELECT id FROM product_assets WHERE idempotency_key=$1',[assetKey]);
  if(!storedAsset.rowCount) throw Object.assign(new Error('Generated Markdown asset could not be persisted.'),{code:'ASSET_PERSIST_FAILED',retryable:true});
  await client.query(`UPDATE product_jobs SET product_id=$2,status='running',updated_at=now() WHERE id=$1`,[productJobId,productId]);
  const targets=await client.query<{code:string;locale:string}>(`SELECT code,locale FROM markets WHERE enabled=true AND code<>$1`,[productJob.market_code]);
  const localizationJobs:ChildJob[]=[];
  for(const target of targets.rows){
    const idempotencyKey=`localization:${productId}:${productJob.market_code}:${target.code}:v1`;
      await client.query(`INSERT INTO localization_jobs(product_id,source_market_code,target_market_code,source_locale,target_locale,status,error_message,input_json,idempotency_key) VALUES($1,$2,$3,$4,$5,'provider_required','No free/local provider; no translation or localization was fabricated.',$6,$7) ON CONFLICT(idempotency_key) DO NOTHING`,[productId,productJob.market_code,target.code,productJob.locale,target.locale,{productJobId,reason:'No verified free/local localization provider.'},idempotencyKey]);
    localizationJobs.push({type:'localization',input:{productId,sourceMarketCode:productJob.market_code,targetMarketCode:target.code,providerKey:''},key:idempotencyKey,parentId:job.id,costClass:'UNKNOWN',terminal:'provider_required',reason:`No verified free/local localization provider is configured for ${target.code}.`});
  }
  return {output:{productJobId,productId,assetId:storedAsset.rows[0]?.id,fileName:`${slug}.md`,sizeBytes:bytes.length,checksumSha256:checksum,method:'deterministic_template_v1',localizationTargetsProviderRequired:targets.rowCount},children:[{type:'asset_validation',input:{productJobId,providerKey:LOCAL_PROVIDER},key:productJobId,parentId:job.id},...localizationJobs] as ChildJob[]};
}

async function handleAssetValidation(client:PoolClient,job:AgentJob) {
  const result=await client.query<any>(`SELECT * FROM product_assets WHERE product_job_id=$1 ORDER BY version DESC,created_at DESC LIMIT 1`,[job.input_json.productJobId]);
  const asset=result.rows[0];
  if(!asset?.asset_bytes) throw Object.assign(new Error('Product asset is missing from private database storage.'),{code:'ASSET_MISSING',retryable:false});
  const bytes=asset.asset_bytes as Buffer;
  const validation=providers.execute<{bytes:Uint8Array;mimeType:string;fileName:string},ReturnType<typeof import('./domain').validateMarkdownAsset>>(LOCAL_PROVIDER,'markdown_validation',{bytes,mimeType:asset.mime_type,fileName:asset.file_name});
  const checksum=createHash('sha256').update(bytes).digest('hex');
  const verified=validation.valid && checksum===asset.checksum_sha256 && Number(asset.size_bytes)===bytes.length;
  await client.query(`UPDATE product_assets SET status=$2 WHERE id=$1`,[asset.id,verified?'validated':'rejected']);
  await client.query(`UPDATE product_jobs SET status=$2,error_message=$3,updated_at=now() WHERE id=$1`,[asset.product_job_id,verified?'completed':'failed',verified?null:'Asset integrity or file checks failed.']);
  return {output:{assetId:asset.id,...validation,checksumVerified:checksum===asset.checksum_sha256,sizeVerified:Number(asset.size_bytes)===bytes.length},children:verified?[{type:'catalog_merchandising',input:{productId:asset.product_id,productJobId:asset.product_job_id,providerKey:LOCAL_PROVIDER},key:asset.product_id,parentId:job.id}]:[] as ChildJob[]};
}

async function handleCatalog(client:PoolClient,job:AgentJob) {
  const r=await client.query<any>(`SELECT p.*,c.name category_name,c.search_terms category_terms,s.name subcategory_name,s.search_terms subcategory_terms FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN subcategories s ON s.id=p.subcategory_id WHERE p.id=$1`,[job.input_json.productId]);
  const p=r.rows[0];
  if(!p) throw Object.assign(new Error('Product draft not found.'),{code:'PRODUCT_NOT_FOUND',retryable:false});
  const terms=[...new Set([p.title,...(p.category_terms??[]),...(p.subcategory_terms??[])].flatMap((x:string)=>x.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((x:string)=>x.length>2))].slice(0,30);
  await client.query(`UPDATE products SET search_terms=$2,metadata_json=metadata_json || $3::jsonb,updated_at=now() WHERE id=$1`,[p.id,terms,{catalog_preparation:{provider:LOCAL_PROVIDER,updated_at:new Date().toISOString()}}]);
  return {output:{productId:p.id,category:p.category_name,subcategory:p.subcategory_name,searchTerms:terms},children:[{type:'quality_safety',input:{productId:p.id,productJobId:job.input_json.productJobId,providerKey:LOCAL_PROVIDER},key:p.id,parentId:job.id}] as ChildJob[]};
}

async function handleQuality(client:PoolClient,job:AgentJob) {
  const r=await client.query<any>(`SELECT pj.brief_json,p.id product_id,a.asset_bytes,a.mime_type,a.file_name,a.status asset_status,a.size_bytes,a.checksum_sha256 FROM product_jobs pj JOIN products p ON p.id=pj.product_id LEFT JOIN product_assets a ON a.product_job_id=pj.id WHERE pj.id=$1 ORDER BY a.version DESC LIMIT 1`,[job.input_json.productJobId]);
  const row=r.rows[0];
  if(!row) throw Object.assign(new Error('Product or brief is missing.'),{code:'QUALITY_INPUT_MISSING',retryable:false});
  const brief=row.brief_json as ReturnType<typeof buildProductBrief>;
  const bytes=(row.asset_bytes??new Uint8Array()) as Uint8Array;
  const validation=providers.execute<{bytes:Uint8Array;mimeType:string;fileName:string},ReturnType<typeof import('./domain').validateMarkdownAsset>>(LOCAL_PROVIDER,'markdown_validation',{bytes,mimeType:row.mime_type??'',fileName:row.file_name??''});
  const checksum=createHash('sha256').update(bytes).digest('hex');
  const integrityVerified=checksum===row.checksum_sha256&&Number(row.size_bytes)===bytes.byteLength;
  const assetValidated=row.asset_status==='validated'&&validation.valid&&integrityVerified;
  const quality=providers.execute<{brief:ReturnType<typeof buildProductBrief>;asset:ReturnType<typeof import('./domain').validateMarkdownAsset>},ReturnType<typeof import('./domain').evaluateQuality>>(LOCAL_PROVIDER,'quality_evaluation',{brief,asset:{...validation,valid:assetValidated,reason:assetValidated?null:'Asset has not passed persisted byte, size, or checksum validation.'}});
  await client.query(`INSERT INTO quality_checks(product_id,product_job_id,check_type,status,score,findings_json,idempotency_key) VALUES($1,$2,'deterministic_template_quality',$3,$4,$5,$6) ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,score=EXCLUDED.score,findings_json=EXCLUDED.findings_json,checked_at=now()`,[row.product_id,job.input_json.productJobId,quality.status,quality.score,JSON.stringify(quality.findings),`quality:${job.input_json.productJobId}:v1`]);
  const children:ChildJob[]=[];
  if(quality.status==='passed') {
    children.push({type:'publishing_policy',input:{productId:row.product_id,productJobId:job.input_json.productJobId,providerKey:LOCAL_PROVIDER},key:row.product_id,parentId:job.id});
    children.push({type:'seo_discovery',input:{productId:row.product_id,providerKey:LOCAL_PROVIDER},key:row.product_id,parentId:job.id});
    children.push({type:'marketing_strategy',input:{productId:row.product_id,providerKey:LOCAL_PROVIDER},key:row.product_id,parentId:job.id});
     children.push({type:'market_feedback',input:{productId:row.product_id,providerKey:LOCAL_PROVIDER},key:`feedback:${row.product_id}`,parentId:job.id});
    children.push({type:'analytics_growth',input:{productId:row.product_id,providerKey:''},key:row.product_id,parentId:job.id,costClass:'UNKNOWN',terminal:'provider_required',reason:'No authorized analytics source is configured; no traffic or sales are fabricated.'});
  }
  return {output:{productId:row.product_id,...quality},children};
}

async function handlePublishingPolicy(client:PoolClient,job:AgentJob) {
  const product=await client.query<any>(`SELECT p.id,p.status,o.market_code,o.locale FROM products p JOIN product_jobs pj ON pj.product_id=p.id JOIN research_opportunities o ON o.id=pj.opportunity_id WHERE p.id=$1 AND pj.id=$2`,[job.input_json.productId,job.input_json.productJobId]);
  if(!product.rowCount) throw Object.assign(new Error('Publishing product or market is missing.'),{code:'PUBLISH_INPUT_MISSING',retryable:false});
  const quality=await client.query(`SELECT 1 FROM quality_checks WHERE product_id=$1 AND product_job_id=$2 AND status='passed' LIMIT 1`,[job.input_json.productId,job.input_json.productJobId]);
  const decision=publishingPolicy({qualityPassed:!!quality.rowCount,approvalRequired:true,approved:false,productStatus:product.rows[0].status});
  const p=product.rows[0];
  const publishing=await client.query<{id:string}>(
    `INSERT INTO publishing_jobs(product_id,market_code,locale,status,approval_required,error_message,idempotency_key)
     VALUES($1,$2,$3,'awaiting_approval',true,$4,$5) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [p.id,p.market_code,p.locale,decision.reason,`publish-review:${p.id}:${p.market_code}:${p.locale}`],
  );
  const publishingId=publishing.rows[0]?.id??(await client.query<{id:string}>('SELECT id FROM publishing_jobs WHERE idempotency_key=$1',[`publish-review:${p.id}:${p.market_code}:${p.locale}`])).rows[0]?.id;
  await client.query(`INSERT INTO agent_approvals(agent_job_id,publishing_job_id,approval_type,request_json) VALUES($1,$2,'publishing',$3) ON CONFLICT DO NOTHING`,[job.id,publishingId,{productId:p.id,publishingJobId:publishingId,requiresReviewedPrice:true,reason:decision.reason}]);
  return {output:{productId:p.id,decision:decision.status,publishingJobId:publishingId,reason:decision.reason},terminalStatus:'approval_required'};
}

async function handleSeo(client:PoolClient,job:AgentJob) {
  const r=await client.query<any>(`SELECT p.id,p.title,p.description,c.name category_name,c.search_terms FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=$1`,[job.input_json.productId]);
  if(!r.rowCount) throw Object.assign(new Error('SEO product not found.'),{code:'PRODUCT_NOT_FOUND',retryable:false});
  const p=r.rows[0];
  const terms=[...new Set([p.title,p.category_name??'',...(p.search_terms??[])].flatMap((x:string)=>x.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((x:string)=>x.length>2))].slice(0,30);
  await client.query(`UPDATE products SET search_terms=$2,metadata_json=metadata_json || $3::jsonb,updated_at=now() WHERE id=$1`,[p.id,terms,{seo:{method:'deterministic_title_category_terms',deceptive_claims:false,updated_at:new Date().toISOString()}}]);
  return {output:{productId:p.id,searchTerms:terms,scope:'internal product metadata; no search-engine requests made'}};
}

async function handleMarketingStrategy(client:PoolClient,job:AgentJob,runId:string) {
  const r=await client.query<any>(`SELECT p.id,p.title,p.description,p.category_id,o.market_code,o.locale FROM products p JOIN product_jobs pj ON pj.product_id=p.id JOIN research_opportunities o ON o.id=pj.opportunity_id WHERE p.id=$1`,[job.input_json.productId]);
  if(!r.rowCount) throw Object.assign(new Error('Marketing strategy input not found.'),{code:'PRODUCT_NOT_FOUND',retryable:false});
  const p=r.rows[0];
  const key=`organic-strategy:${p.id}:v1`;
  const strategy=await client.query<{id:string}>(
    `INSERT INTO marketing_strategies(market_code,locale,product_id,category_id,objective,strategy_type,audience_definition_json,positioning_json,channel_plan_json,content_plan_json,budget_json,status,idempotency_key)
     VALUES($1,$2,$3,$4,'Prepare private organic discovery plan','organic_first',$5,$6,$7,$8,$9,'draft',$10)
     ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [p.market_code,p.locale,p.id,p.category_id,{status:'needs_evidence_review'},{positioning:'Useful practical resource; claims must remain evidence-backed.'},{priority:['marketplace search','SEO','useful content','authorized organic social']},{contentTypes:['product metadata','SEO description','social draft'],externalDistribution:'disabled'},{autonomous_spend_minor:0,paid_actions:'blocked',unknown_cost:'blocked'},key],
  );
  let strategyId=strategy.rows[0]?.id;
  if(!strategyId) strategyId=(await client.query<{id:string}>('SELECT id FROM marketing_strategies WHERE idempotency_key=$1',[key])).rows[0]?.id;
  if(!strategyId) throw new Error('Could not persist organic marketing strategy.');
  const campaignKey=`organic-campaign:${p.id}:v1`;
  const campaign=await client.query<{id:string}>(`INSERT INTO marketing_campaigns(strategy_id,product_id,name,objective,status,target_definition_json,approval_required,idempotency_key) VALUES($1,$2,$3,'Internal organic discovery plan','draft',$4,true,$5) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,[strategyId,p.id,`${p.title} — organic discovery draft`,{market:p.market_code,locale:p.locale,allowedChannels:['marketplace','website SEO'],externalPosting:false},campaignKey]);
  let campaignId=campaign.rows[0]?.id;
  if(!campaignId) campaignId=(await client.query<{id:string}>('SELECT id FROM marketing_campaigns WHERE idempotency_key=$1',[campaignKey])).rows[0]?.id;
  if(!campaignId) throw new Error('Could not persist organic campaign draft.');
  return {output:{strategyId,campaignId,productId:p.id,status:'private draft'},children:[{type:'marketing_content',input:{campaignId,productId:p.id,providerKey:LOCAL_PROVIDER},key:campaignId,parentId:job.id},{type:'campaign_execution',input:{campaignId,providerKey:''},key:campaignId,parentId:job.id,costClass:'UNKNOWN',terminal:'provider_required',reason:'No authorized external marketing account/provider is configured; external communication is disabled.'}] as ChildJob[]};
}

async function handleMarketingContent(client:PoolClient,job:AgentJob,runId:string) {
  const r=await client.query<any>(`SELECT c.id campaign_id,p.id product_id,p.title,p.description,pe.locale FROM marketing_campaigns c JOIN products p ON p.id=c.product_id JOIN marketing_strategies s ON s.id=c.strategy_id JOIN LATERAL (SELECT locale FROM product_editions WHERE product_id=p.id ORDER BY created_at DESC LIMIT 1) pe ON true WHERE c.id=$1`,[job.input_json.campaignId]);
  if(!r.rowCount) {
    const draft=await client.query<any>(`SELECT c.id campaign_id,p.id product_id,p.title,p.description,s.locale FROM marketing_campaigns c JOIN products p ON p.id=c.product_id JOIN marketing_strategies s ON s.id=c.strategy_id WHERE c.id=$1`,[job.input_json.campaignId]);
    if(!draft.rowCount) throw Object.assign(new Error('Marketing content input not found.'),{code:'CAMPAIGN_NOT_FOUND',retryable:false});
    r.rows.push(draft.rows[0]);
  }
  const p=r.rows[0];
  const content=await client.query<{id:string}>(
    `INSERT INTO marketing_content(campaign_id,product_id,channel,content_type,locale,title,body,metadata_json,approval_status,idempotency_key)
     VALUES($1,$2,'website_seo','product_summary',$3,$4,$5,$6,'draft',$7) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [p.campaign_id,p.product_id,p.locale??'en',p.title,`${p.title}. ${p.description} Review the complete product information before making a purchase.`,{generated_by:'deterministic_local_template',run_id:runId,external_send:false},`marketing-content:${p.campaign_id}:v1`],
  );
  const contentId=content.rows[0]?.id ?? (await client.query<{id:string}>('SELECT id FROM marketing_content WHERE idempotency_key=$1',[`marketing-content:${p.campaign_id}:v1`])).rows[0]?.id;
  return {output:{contentId,campaignId:p.campaign_id,status:'private unapproved draft',externalSend:false}};
}

async function handleFeedback(client:PoolClient,job:AgentJob) {
  await client.query('BEGIN');
  try {
  const signals=await client.query<any>(`SELECT id,market_code,product_id,source_reference,summary,evidence_json FROM market_feedback_signals WHERE processed_at IS NULL AND product_id=$1 ORDER BY observed_at LIMIT 100 FOR UPDATE SKIP LOCKED`,[job.input_json.productId]);
  for(const signal of signals.rows) {
    if(signal.product_id) {
      const opp=await client.query<{id:string}>('SELECT id FROM research_opportunities WHERE market_code=$1 AND category_id=(SELECT category_id FROM products WHERE id=$2) ORDER BY created_at DESC LIMIT 1',[signal.market_code,signal.product_id]);
      if(opp.rowCount) await client.query(`UPDATE research_opportunities SET evidence_json=evidence_json || $2::jsonb,source_references_json=source_references_json || $3::jsonb,updated_at=now() WHERE id=$1`,[opp.rows[0].id,JSON.stringify([{type:'market_feedback_signal',signal_id:signal.id,summary:signal.summary,evidence:signal.evidence_json}]),JSON.stringify(signal.source_reference?[{type:'feedback_reference',reference:signal.source_reference}]:[])]);
    }
    await client.query('UPDATE market_feedback_signals SET processed_at=now() WHERE id=$1',[signal.id]);
  }
  await client.query('COMMIT');
  return {output:{processedSignals:signals.rowCount,scope:'aggregated/de-identified signals only'}};
  } catch(error) { await client.query('ROLLBACK'); throw error; }
}

async function executeJob(job: AgentJob,runId:string) {
  const client=await db.connect();
  try {
    let result: {output:unknown;children?:ChildJob[];terminalStatus?:string};
    switch(job.job_type) {
      case 'market_research': result=await findCatalogGaps(client,runId,job.id,job.input_json.marketCode,job.input_json.categorySlug);break;
      case 'opportunity_scoring': result=await handleScoring(client,job);break;
      case 'product_brief': result=await handleBrief(client,job,runId);break;
      case 'product_generation': result=await handleGeneration(client,job,runId);break;
      case 'asset_validation': result=await handleAssetValidation(client,job);break;
      case 'catalog_merchandising': result=await handleCatalog(client,job);break;
      case 'quality_safety': result=await handleQuality(client,job);break;
      case 'publishing_policy': result=await handlePublishingPolicy(client,job);break;
      case 'seo_discovery': result=await handleSeo(client,job);break;
      case 'marketing_strategy': result=await handleMarketingStrategy(client,job,runId);break;
      case 'marketing_content': result=await handleMarketingContent(client,job,runId);break;
      case 'market_feedback': result=await handleFeedback(client,job);break;
      case 'localization': result={output:{status:'provider_required',reason:'No free/local translation provider is configured.'},terminalStatus:'provider_required'};break;
      case 'analytics_growth': result={output:{status:'provider_required',reason:'No authorized analytics source is configured.'},terminalStatus:'provider_required'};break;
      case 'campaign_execution': result={output:{status:'provider_required',reason:'No authorized marketing integration is configured.'},terminalStatus:'provider_required'};break;
      default: result={output:{status:'provider_required',reason:'No implementation/provider is registered for this agent capability.'},terminalStatus:'provider_required'};
    }
    await client.query('BEGIN');
    const status=result.terminalStatus??'completed';
    const terminalReason=(result.output as {reason?:string}|null)?.reason??null;
    await client.query(`UPDATE agent_jobs SET status=$2,output_json=$3,error_code=CASE WHEN $4 IS NULL THEN NULL ELSE upper($2) END,error_message=$4,completed_at=now(),locked_at=NULL,updated_at=now() WHERE id=$1`,[job.id,status,result.output,terminalReason]);
    if(job.job_type==='publishing_policy') {
      const publishingId=(result.output as any)?.publishingJobId;
      if(publishingId) await client.query(`UPDATE agent_approvals SET request_json=request_json || $2::jsonb WHERE agent_job_id=$1 AND approval_type='publishing' AND status='pending'`,[job.id,{publishingJobId:publishingId}]);
    }
    await addEvent(client,runId,`${job.job_type}_${status}`,`${job.job_type} ${status}.`,{jobId:job.id,result:result.output},status==='completed'?'info':'warning');
    for(const child of result.children??[]) await enqueueChild(client,runId,child);
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function finalizeRun(runId:string) {
  await db.query(
    `UPDATE agent_runs r SET
       status=CASE WHEN EXISTS(SELECT 1 FROM agent_jobs j WHERE j.agent_run_id=r.id AND j.status='failed') THEN 'failed'
                   WHEN EXISTS(SELECT 1 FROM agent_jobs j WHERE j.agent_run_id=r.id AND j.status IN ('queued','retry_wait','waiting_dependency','running')) THEN 'running'
                   ELSE 'completed' END,
       completed_at=CASE WHEN EXISTS(SELECT 1 FROM agent_jobs j WHERE j.agent_run_id=r.id AND j.status IN ('queued','retry_wait','waiting_dependency','running')) THEN NULL ELSE now() END,
       error_message=CASE WHEN EXISTS(SELECT 1 FROM agent_jobs j WHERE j.agent_run_id=r.id AND j.status='failed') THEN COALESCE((SELECT j.error_message FROM agent_jobs j WHERE j.agent_run_id=r.id AND j.status='failed' ORDER BY j.updated_at,j.id LIMIT 1),r.error_message) ELSE r.error_message END
     WHERE r.id=$1`,[runId],
  );
}

export async function processAgentRun(runId:string) {
  let processed=0;
  while(processed<MAX_JOBS_PER_REQUEST) {
    const job=await claimNextJob(runId);
    if(!job) break;
    processed++;
    const client=await db.connect();
    let assessment:OperationAssessment;
    try { assessment=await getProviderAssessment(client,job); }
    catch(error) {
      client.release();
      await finishJob(job,'failed',null,[],classifyExecutionError(error));
      continue;
    }
    client.release();
    if(assessment.status!=='allowed') { await failPolicy(job,assessment); continue; }
    try { await executeJob(job,runId); }
    catch(error) {
      await finishJob(job,'failed',null,[],classifyExecutionError(error));
    }
  }
  await finalizeRun(runId);
  const snapshot=await db.query<any>(
    `SELECT r.id,r.agent_type,r.status,r.started_at,r.completed_at,
       COUNT(j.id)::int job_count,
       COUNT(j.id) FILTER(WHERE j.status='completed')::int completed_jobs,
       COUNT(j.id) FILTER(WHERE j.status='failed')::int failed_jobs,
       COUNT(j.id) FILTER(WHERE j.status='blocked')::int blocked_jobs,
       COUNT(j.id) FILTER(WHERE j.status='provider_required')::int provider_required_jobs,
       COUNT(j.id) FILTER(WHERE j.status='approval_required')::int approval_required_jobs
     FROM agent_runs r LEFT JOIN agent_jobs j ON j.agent_run_id=r.id WHERE r.id=$1 GROUP BY r.id`,[runId],
  );
  return snapshot.rows[0] ?? null;
}

export async function runDueSchedules(requestedBy:string) {
  const client=await db.connect();
  const runs:string[]=[];
  try{
    await client.query('BEGIN');
    const due=await client.query<any>(`SELECT id,agent_type,schedule_expression,timezone,configuration_json,next_run_at FROM agent_schedules WHERE enabled=true AND next_run_at<=now() ORDER BY next_run_at,id FOR UPDATE SKIP LOCKED LIMIT $1`,[MAX_SCHEDULES_PER_REQUEST]);
    for(const schedule of due.rows){
      const interval=scheduleIntervalMs(schedule.schedule_expression,schedule.timezone);
      const scheduledAt=new Date(schedule.next_run_at).toISOString();
      const key=safeIdempotencyKey(`schedule:${schedule.id}:${scheduledAt}`);
      const run=await client.query<{id:string}>(`INSERT INTO agent_runs(agent_type,status,input_json,provenance_json,started_at) VALUES($1,'running',$2,$3,now()) RETURNING id`,[schedule.agent_type,{source:'agent_schedule',scheduleId:schedule.id,scheduledAt,requestedBy,configuration:schedule.configuration_json},{scheduleId:schedule.id,scheduledAt,method:'bounded_utc_interval'}]);
      const eligible=interval!==null&&schedule.agent_type==='market_research';
      const status=eligible?'queued':'blocked';
      const reason=interval===null?'Unsupported schedule or timezone; safe scheduler supports UTC @hourly, @daily and @weekly only.':'No automatic handler is registered for this schedule agent type.';
      await client.query(`INSERT INTO agent_jobs(agent_run_id,job_type,status,cost_class,input_json,output_json,idempotency_key,completed_at,error_code,error_message) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $3='blocked' THEN now() ELSE NULL END,CASE WHEN $3='blocked' THEN 'SCHEDULE_BLOCKED' END,CASE WHEN $3='blocked' THEN $8 END)`,[run.rows[0].id,schedule.agent_type,status,eligible?'FREE':'BLOCKED',eligible?{providerKey:LOCAL_PROVIDER,marketCode:schedule.configuration_json?.marketCode}:{reason},{status:eligible?'queued':'blocked',reason:eligible?null:reason},key,reason]);
      await addEvent(client,run.rows[0].id,eligible?'schedule_job_queued':'schedule_blocked',eligible?'Due free internal research schedule queued.':reason,{scheduleId:schedule.id,scheduledAt,requestedBy},eligible?'info':'warning');
      if(eligible) runs.push(run.rows[0].id);
      else await client.query(`UPDATE agent_runs SET status='completed',completed_at=now() WHERE id=$1`,[run.rows[0].id]);
      await client.query(`UPDATE agent_schedules SET enabled=$3,last_run_at=now(),next_run_at=CASE WHEN $3 THEN now()+($2::bigint*interval '1 millisecond') ELSE NULL END,updated_at=now() WHERE id=$1`,[schedule.id,interval??0,eligible]);
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
  const completed=[];
  for(const runId of runs) completed.push(await processAgentRun(runId));
  return {dueCount:runs.length,processed:completed};
}

export async function getFactoryOverview() {
  const [counts,runs,opportunities,jobs,approvals,policy,categories,schedules,events,productJobs,assets,qualityChecks,publishing,growth]=await Promise.all([
    db.query<any>(`SELECT status,COUNT(*)::int count FROM agent_jobs GROUP BY status`),
    db.query<any>(`SELECT r.id,r.agent_type,r.status,r.started_at,r.completed_at,COUNT(j.id)::int job_count FROM agent_runs r LEFT JOIN agent_jobs j ON j.agent_run_id=r.id GROUP BY r.id ORDER BY r.created_at DESC LIMIT 20`),
    db.query<any>(`SELECT id,market_code,title,opportunity_score,priority,confidence_score,status,created_at,source_summary,evidence_json,source_references_json,provenance_json FROM research_opportunities ORDER BY created_at DESC LIMIT 30`),
    db.query<any>(`SELECT j.id,j.agent_run_id,j.job_type,j.status,j.cost_class,j.retry_count,j.error_code,j.error_message,j.created_at FROM agent_jobs j ORDER BY j.created_at DESC LIMIT 30`),
    db.query<any>(`SELECT a.id,a.approval_type,a.status,a.requested_at,a.request_json,j.job_type FROM agent_approvals a JOIN agent_jobs j ON j.id=a.agent_job_id WHERE a.status='pending' ORDER BY a.requested_at LIMIT 20`),
    db.query<any>(`SELECT max_spend_minor,currency_code,paid_actions_allowed,owner_approval_required,unknown_cost_action FROM agent_financial_policies WHERE agent_type='*' AND policy_status='active' LIMIT 1`),
    db.query<any>(`SELECT slug,name FROM categories WHERE enabled=true ORDER BY sort_order,name`),
    db.query<any>(`SELECT id,agent_type,schedule_expression,timezone,enabled,last_run_at,next_run_at FROM agent_schedules ORDER BY enabled DESC,next_run_at NULLS LAST LIMIT 20`),
    db.query<any>(`SELECT e.id,e.agent_run_id,e.event_type,e.level,e.message,e.data_json,e.created_at FROM agent_events e ORDER BY e.created_at DESC LIMIT 40`),
    db.query<any>(`SELECT id,opportunity_id,product_id,job_type,status,brief_version,error_message,created_at FROM product_jobs ORDER BY created_at DESC LIMIT 20`),
    db.query<any>(`SELECT id,product_job_id,product_id,asset_type,file_name,mime_type,version,status,size_bytes,checksum_sha256,created_at FROM product_assets ORDER BY created_at DESC LIMIT 20`),
    db.query<any>(`SELECT id,product_id,product_job_id,check_type,status,score,findings_json,checked_at FROM quality_checks ORDER BY checked_at DESC LIMIT 20`),
    db.query<any>(`SELECT id,product_id,product_edition_id,market_code,locale,status,approval_required,approved_by,approved_at,published_at,error_message,created_at FROM publishing_jobs ORDER BY created_at DESC LIMIT 20`),
    db.query<any>(`SELECT kind,status,COUNT(*)::int count FROM (SELECT 'strategy' kind,status FROM marketing_strategies UNION ALL SELECT 'campaign',status FROM marketing_campaigns UNION ALL SELECT 'content',approval_status FROM marketing_content UNION ALL SELECT 'publication',status FROM marketing_publications) activity GROUP BY kind,status ORDER BY kind,status`),
  ]);
  const statusMap={free_internal:'EXECUTABLE_FREE',provider_required:'PROVIDER_REQUIRED',approval_required:'APPROVAL_REQUIRED',blocked:'BLOCKED'};
  return {counts:counts.rows,runs:runs.rows,opportunities:opportunities.rows,jobs:jobs.rows,approvals:approvals.rows,financialPolicy:policy.rows[0]??null,categories:categories.rows,schedules:schedules.rows,events:events.rows,productJobs:productJobs.rows,assets:assets.rows,qualityChecks:qualityChecks.rows,publishing:publishing.rows,growth:growth.rows,capabilities:factoryAgents.map((agent)=>({agent:agent.label,status:statusMap[agent.execution],scope:agent.description}))};
}

export async function getRunEvents(runId:string) {
  const result=await db.query<any>(`SELECT id,event_type,level,message,data_json,created_at FROM agent_events WHERE agent_run_id=$1 ORDER BY created_at,id`,[runId]);
  return result.rows;
}
