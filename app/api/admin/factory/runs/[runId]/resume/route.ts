import { NextResponse } from 'next/server';
import { FactoryAccessError, requireFactoryAccess } from '@/lib/server/factory/access';
import { processAgentRun } from '@/lib/server/factory/orchestrator';

export async function POST(_request:Request,{params}:{params:Promise<{runId:string}>}){
  try{
    await requireFactoryAccess('manage');
    const {runId}=await params;
    if(!/^[0-9a-f-]{36}$/i.test(runId)) return NextResponse.json({error:'Invalid run id.'},{status:400});
    const run=await processAgentRun(runId);
    if(!run) return NextResponse.json({error:'Run not found.'},{status:404});
    return NextResponse.json({run},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error instanceof FactoryAccessError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:'Factory service is unavailable.'},{status:503});
  }
}
