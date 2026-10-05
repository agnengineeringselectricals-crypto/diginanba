import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const {Pool}=pg;
const testUrl=process.env.FACTORY_TEST_DATABASE_URL;

async function runIntegration(){
  if(!testUrl){
    console.log('SKIP database-backed Factory integration: FACTORY_TEST_DATABASE_URL is not configured.');
    return;
  }
  process.env.DATABASE_URL=testUrl;
  if(!process.env.DATABASE_SSL) process.env.DATABASE_SSL='false';
  const {createResearchRun,processAgentRun}=await import('./orchestrator.ts');
  const {db}=await import('../../db.ts');
  const pool=new Pool({connectionString:testUrl,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}});
  const token=randomUUID();
  const categorySlug=`factory-it-${token.slice(0,8)}`;
  const key=`factory-integration-${token}`;
  let categoryId;
  const runIds=[];
  const productIds=[];

  try{
    const identity=await pool.query('SELECT current_database() database_name');
    assert.match(identity.rows[0].database_name,/(^|[_-])(test|testing|integration)([_-]|$)/i,'Refusing to run destructive cleanup outside a clearly named test database.');
    const category=await pool.query(`INSERT INTO categories(slug,name,sort_order,enabled) VALUES($1,$2,999999,true) RETURNING id`,[categorySlug,`Factory integration ${token.slice(0,8)}`]);
    categoryId=category.rows[0].id;

    const runId=await createResearchRun(randomUUID(),key,{marketCode:'US',categorySlug});
    runIds.push(runId);
    assert.equal(await createResearchRun(randomUUID(),key,{marketCode:'US',categorySlug}),runId,'Idempotent start must return the original run.');

    let snapshot;
    for(let attempt=0;attempt<8;attempt++){
      snapshot=await processAgentRun(runId);
      if(snapshot?.status!=='running') break;
    }
    assert.equal(snapshot?.status,'completed','Bounded continuations should finish the local deterministic stages.');

    const opportunity=await pool.query(`SELECT id,confidence_score,priority,evidence_json,provenance_json FROM research_opportunities WHERE opportunity_key=$1`,[`catalog-gap-v1:US:${categorySlug}`]);
    assert.equal(opportunity.rowCount,1);
    assert.equal(opportunity.rows[0].priority,'LOW');
    assert.equal(Number(opportunity.rows[0].confidence_score),0.05);
    assert.equal(opportunity.rows[0].evidence_json[0].type,'internal_catalog_gap');

    const product=await pool.query(`SELECT id,status,metadata_json FROM products WHERE metadata_json->>'provenance' IS NOT NULL AND slug LIKE $1`,[`catalog-coverage-review-${opportunity.rows[0].id.slice(0,8)}%`]);
    assert.equal(product.rowCount,1,'One actual private product draft should exist.');
    productIds.push(product.rows[0].id);
    assert.equal(product.rows[0].status,'draft');
    assert.equal((await pool.query(`SELECT count(*)::int count FROM product_editions WHERE product_id=$1`,[product.rows[0].id])).rows[0].count,0,'Factory generation must not create a public market edition.');

    const productJob=await pool.query(`SELECT id,status,product_id,brief_json FROM product_jobs WHERE opportunity_id=$1`,[opportunity.rows[0].id]);
    assert.equal(productJob.rowCount,1);
    assert.equal(productJob.rows[0].status,'completed');
    assert.equal(productJob.rows[0].product_id,product.rows[0].id);
    assert.equal(productJob.rows[0].brief_json.evidence_basis,'internal_catalog_inventory_only');

    const asset=await pool.query(`SELECT asset_bytes,file_name,mime_type,version,size_bytes,checksum_sha256,metadata_json,status FROM product_assets WHERE product_job_id=$1`,[productJob.rows[0].id]);
    assert.equal(asset.rowCount,1);
    assert.ok(Buffer.isBuffer(asset.rows[0].asset_bytes)&&asset.rows[0].asset_bytes.length>100,'The Markdown deliverable must be stored as bytes.');
    assert.match(asset.rows[0].file_name,/^[a-z0-9][a-z0-9._-]+\.md$/i);
    assert.equal(asset.rows[0].mime_type,'text/markdown');
    assert.equal(asset.rows[0].version,1);
    assert.equal(Number(asset.rows[0].size_bytes),asset.rows[0].asset_bytes.length);
    assert.equal(asset.rows[0].checksum_sha256,createHash('sha256').update(asset.rows[0].asset_bytes).digest('hex'));
    assert.equal(asset.rows[0].metadata_json.encoding,'utf-8');
    assert.equal(asset.rows[0].metadata_json.evidence_confidence,0.05);
    assert.equal(asset.rows[0].status,'validated');

    const quality=await pool.query(`SELECT status,findings_json,idempotency_key FROM quality_checks WHERE product_job_id=$1`,[productJob.rows[0].id]);
    assert.equal(quality.rowCount,1);
    assert.equal(quality.rows[0].status,'passed');
    assert.ok(quality.rows[0].idempotency_key);
    assert.equal((await pool.query(`SELECT count(*)::int count FROM marketing_strategies WHERE product_id=$1 AND status='draft'`,[product.rows[0].id])).rows[0].count,1);
    const campaign=await pool.query(`SELECT id,status,idempotency_key FROM marketing_campaigns WHERE product_id=$1`,[product.rows[0].id]);
    assert.equal(campaign.rowCount,1);
    assert.equal(campaign.rows[0].status,'draft');
    assert.ok(campaign.rows[0].idempotency_key);
    const content=await pool.query(`SELECT approval_status,metadata_json FROM marketing_content WHERE campaign_id=$1`,[campaign.rows[0].id]);
    assert.equal(content.rowCount,1);
    assert.equal(content.rows[0].approval_status,'draft');
    assert.equal(content.rows[0].metadata_json.external_send,false);

    const dependencies=await pool.query(`SELECT count(*)::int count FROM agent_jobs child JOIN agent_jobs parent ON parent.id=child.parent_job_id WHERE child.agent_run_id=$1 AND child.status IN ('completed','provider_required','approval_required','blocked') AND parent.status<>'completed'`,[runId]);
    assert.equal(dependencies.rows[0].count,0,'Terminal children may only run after completed dependencies.');
    const statusCounts=await pool.query(`SELECT status,count(*)::int count FROM agent_jobs WHERE agent_run_id=$1 GROUP BY status`,[runId]);
    const statuses=new Map(statusCounts.rows.map((row)=>[row.status,row.count]));
    assert.ok(statuses.get('completed')>=10);
    assert.ok(statuses.get('provider_required')>=1);
    assert.ok(statuses.get('approval_required')>=1);
    assert.equal(statuses.get('failed')??0,0);

    const before=await pool.query(`SELECT count(*)::int jobs FROM agent_jobs WHERE agent_run_id=$1`,[runId]);
    await processAgentRun(runId);
    assert.equal((await pool.query(`SELECT count(*)::int jobs FROM agent_jobs WHERE agent_run_id=$1`,[runId])).rows[0].jobs,before.rows[0].jobs,'A completed run must not execute or enqueue children a second time.');
    assert.equal((await pool.query(`SELECT count(*)::int count FROM quality_checks WHERE product_job_id=$1`,[productJob.rows[0].id])).rows[0].count,1,'Quality retries must be idempotent.');

    await pool.query('BEGIN');
    await pool.query('SAVEPOINT public_publish_must_fail');
    let publicationRejected=false;
    try{await pool.query(`UPDATE products SET status='published' WHERE id=$1`,[product.rows[0].id]);}
    catch(error){publicationRejected=error.code==='23514';await pool.query('ROLLBACK TO SAVEPOINT public_publish_must_fail');}
    assert.equal(publicationRejected,true,'Even a passing QA result cannot publish a factory draft without approval, edition, and price.');
    await pool.query('RELEASE SAVEPOINT public_publish_must_fail');
    await pool.query('COMMIT');

    const blockedRun=(await pool.query(`INSERT INTO agent_runs(agent_type,status,started_at) VALUES('integration_policy','running',now()) RETURNING id`)).rows[0].id;
    runIds.push(blockedRun);
    const blockedJob=(await pool.query(`INSERT INTO agent_jobs(agent_run_id,job_type,status,cost_class,input_json,idempotency_key) VALUES($1,'market_research','queued','PAID',$2,$3) RETURNING id`,[blockedRun,{providerKey:'diginanba-local-deterministic'},`integration-paid-${token}`])).rows[0].id;
    await processAgentRun(blockedRun);
    let blocked=await pool.query('SELECT status,retry_count FROM agent_jobs WHERE id=$1',[blockedJob]);
    assert.equal(blocked.rows[0].status,'blocked');
    assert.equal(blocked.rows[0].retry_count,1);
    await processAgentRun(blockedRun);
    blocked=await pool.query('SELECT status,retry_count FROM agent_jobs WHERE id=$1',[blockedJob]);
    assert.deepEqual(blocked.rows[0],{status:'blocked',retry_count:1});

    const failedRun=(await pool.query(`INSERT INTO agent_runs(agent_type,status,started_at) VALUES('integration_failure','running',now()) RETURNING id`)).rows[0].id;
    runIds.push(failedRun);
    const failedJob=(await pool.query(`INSERT INTO agent_jobs(agent_run_id,job_type,status,cost_class,input_json,idempotency_key) VALUES($1,'opportunity_scoring','queued','FREE',$2,$3) RETURNING id`,[failedRun,{providerKey:'diginanba-local-deterministic',opportunityId:randomUUID()},`integration-failed-${token}`])).rows[0].id;
    await processAgentRun(failedRun);
    let failed=await pool.query('SELECT status,retry_count,error_code FROM agent_jobs WHERE id=$1',[failedJob]);
    assert.equal(failed.rows[0].status,'failed');
    assert.equal(failed.rows[0].retry_count,1);
    assert.equal(failed.rows[0].error_code,'OPPORTUNITY_NOT_FOUND');
    await processAgentRun(failedRun);
    failed=await pool.query('SELECT status,retry_count FROM agent_jobs WHERE id=$1',[failedJob]);
    assert.deepEqual(failed.rows[0],{status:'failed',retry_count:1});

    const staleRun=(await pool.query(`INSERT INTO agent_runs(agent_type,status,started_at) VALUES('integration_stale','running',now()-interval '6 minutes') RETURNING id`)).rows[0].id;
    runIds.push(staleRun);
    const staleJob=(await pool.query(`INSERT INTO agent_jobs(agent_run_id,job_type,status,cost_class,input_json,idempotency_key,retry_count,max_retries,started_at,locked_at) VALUES($1,'market_research','running','FREE',$2,$3,3,2,now()-interval '6 minutes',now()-interval '6 minutes') RETURNING id`,[staleRun,{providerKey:'diginanba-local-deterministic'},`integration-stale-${token}`])).rows[0].id;
    await processAgentRun(staleRun);
    const stale=await pool.query('SELECT status,retry_count,error_code FROM agent_jobs WHERE id=$1',[staleJob]);
    assert.deepEqual(stale.rows[0],{status:'failed',retry_count:3,error_code:'STALE_EXECUTION'});

  }finally{
    if(categoryId){
      const generated=await pool.query(`SELECT id FROM products WHERE category_id=$1 AND metadata_json->>'source'='autonomous_product_factory'`,[categoryId]);
      productIds.push(...generated.rows.map((row)=>row.id).filter((id)=>!productIds.includes(id)));
    }
    if(runIds.length){
      await pool.query(`DELETE FROM agent_approvals WHERE agent_job_id IN (SELECT id FROM agent_jobs WHERE agent_run_id=ANY($1::uuid[]))`,[runIds]);
      await pool.query(`DELETE FROM marketing_content WHERE product_id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM marketing_campaigns WHERE product_id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM marketing_strategies WHERE product_id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM publishing_jobs WHERE product_id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM quality_checks WHERE product_id=ANY($1::uuid[]) OR product_job_id IN (SELECT id FROM product_jobs WHERE product_id=ANY($1::uuid[]))`,[productIds]);
      await pool.query(`DELETE FROM product_assets WHERE product_id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM localization_jobs WHERE product_id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM product_jobs WHERE product_id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM products WHERE id=ANY($1::uuid[])`,[productIds]);
      await pool.query(`DELETE FROM research_opportunities WHERE opportunity_key=$1`,[`catalog-gap-v1:US:${categorySlug}`]);
      await pool.query(`DELETE FROM agent_events WHERE agent_run_id=ANY($1::uuid[])`,[runIds]);
      await pool.query(`DELETE FROM agent_jobs WHERE agent_run_id=ANY($1::uuid[])`,[runIds]);
      await pool.query(`DELETE FROM agent_runs WHERE id=ANY($1::uuid[])`,[runIds]);
    }
    if(categoryId) await pool.query('DELETE FROM categories WHERE id=$1',[categoryId]);
    await pool.end();
    await db.end();
  }
}

await runIntegration();
