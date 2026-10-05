import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FactoryAccessError, requireFactoryAccess } from '@/lib/server/factory/access';
import { createOpportunityScoringRun, createResearchRun, getFactoryOverview, processAgentRun, runDueSchedules } from '@/lib/server/factory/orchestrator';

const sourceSchema=z.object({url:z.string().url().max(2000).refine((value)=>value.startsWith('https://'),'Only public HTTPS source URLs are accepted.'),summary:z.string().trim().min(10).max(1000)});
const requestSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('catalog_research'),idempotencyKey:z.uuid(),marketCode:z.enum(['US','UK']).optional(),categorySlug:z.string().regex(/^[a-z0-9-]+$/).optional()}),
  z.object({action:z.literal('run_due_schedules'),idempotencyKey:z.uuid()}),
  z.object({action:z.literal('score_opportunity'),idempotencyKey:z.uuid(),marketCode:z.enum(['US','UK']),title:z.string().trim().min(8).max(180),problemStatement:z.string().trim().min(20).max(2000),sourceSummary:z.string().trim().min(20).max(1200),categorySlug:z.string().regex(/^[a-z0-9-]+$/).optional(),subcategorySlug:z.string().regex(/^[a-z0-9-]+$/).optional(),sources:z.array(sourceSchema).min(3).max(12).refine((sources)=>new Set(sources.map((source)=>{try{return new URL(source.url).hostname.toLowerCase();}catch{return ''}})).size>=3,'Provide references from at least three distinct hosts.').refine((sources)=>new Set(sources.map((source)=>source.summary.toLowerCase())).size===sources.length,'Each source needs its own summary.')}).refine((item)=>!item.subcategorySlug||!!item.categorySlug,'A subcategory requires a parent category.'),
]);

function accessError(error:unknown){
  if(error instanceof FactoryAccessError) return NextResponse.json({error:error.message},{status:error.status});
  return NextResponse.json({error:'Factory service is unavailable. Confirm the database schema has been applied.'},{status:503});
}

export async function GET(){
  try{await requireFactoryAccess('view');return NextResponse.json(await getFactoryOverview(),{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return accessError(error);}
}

export async function POST(request:Request){
  let access;
  try{access=await requireFactoryAccess('manage');}
  catch(error){return accessError(error);}
  try{
    const parsed=requestSchema.safeParse(await request.json());
    if(!parsed.success) return NextResponse.json({error:'Invalid request.',details:parsed.error.issues.map((issue)=>({path:issue.path,message:issue.message}))},{status:400});
    const body=parsed.data;
    if(body.action==='run_due_schedules') return NextResponse.json({scheduleResult:await runDueSchedules(access.userId)},{headers:{'Cache-Control':'private, no-store'}});
    const runId=body.action==='catalog_research'
      ? await createResearchRun(access.userId,body.idempotencyKey,{marketCode:body.marketCode,categorySlug:body.categorySlug})
      : await createOpportunityScoringRun(access.userId,body.idempotencyKey,body);
    const run=await processAgentRun(runId);
    return NextResponse.json({run},{status:202,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to start factory work.';
    const status=(error as {code?:string})?.code==='23503'?400:(error as {retryable?:boolean})?.retryable===false?422:503;
    return NextResponse.json({error:status===503?'Factory service is unavailable.':message},{status});
  }
}
