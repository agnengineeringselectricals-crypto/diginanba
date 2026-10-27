import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ productId: string }> };

const fieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(80),
  type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'formula']),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string().max(500), z.number(), z.boolean(), z.null()]).optional(),
  options: z.array(z.string().max(100)).max(30).optional(),
  formula: z.string().max(500).optional()
});
const definitionSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  editorProfile: z.enum(['student', 'freelancer', 'homemaker', 'educator', 'designer', 'developer', 'other']).default('other'),
  description: z.string().max(4000).default(''),
  fields: z.array(fieldSchema).max(100).default([])
});
const requestSchema = z.object({
  instruction: z.string().trim().min(8).max(5000),
  expectedVersion: z.number().int().positive()
});
function safeJson(value: string) {
  const start=value.indexOf('{'); const end=value.lastIndexOf('}');
  if(start<0||end<=start) throw new Error('AI returned no structured draft');
  return JSON.parse(value.slice(start,end+1));
}

export async function POST(request: Request, { params }: Context) {
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:'Sign in to use the AI creator assistant.'},{status:401});
  const parsed=requestSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:'Enter a clear instruction (8–5,000 characters).',details:parsed.error.flatten()},{status:400});
  const apiKey=process.env.CREATOR_AI_API_KEY||process.env.OPENAI_API_KEY;
  if(!apiKey) return NextResponse.json({error:'AI editing is not configured yet. Set CREATOR_AI_API_KEY or OPENAI_API_KEY in Vercel.'},{status:503});
  const {productId}=await params;
  const client=await db.connect();
  try {
    await client.query('BEGIN');
    const result=await client.query(
      `SELECT p.id,p.title,p.description,p.status,p.moderation_status,
              b.id AS build_id,b.version_number,b.build_kind,b.definition_json,b.status AS build_status
       FROM products p JOIN LATERAL
         (SELECT * FROM product_builds WHERE product_id=p.id ORDER BY version_number DESC LIMIT 1) b ON true
       WHERE p.id=$1 AND p.creator_user_id=$2 FOR UPDATE OF p`,
      [productId,session.user.id]);
    const row=result.rows[0];
    if(!row){await client.query('ROLLBACK');return NextResponse.json({error:'Workspace not found or access denied.'},{status:404});}
    if(row.status!=='draft'||['approved','published','active'].includes(String(row.moderation_status))){
      await client.query('ROLLBACK');return NextResponse.json({error:'AI editing is available only for your private, unpublished draft.'},{status:409});
    }
    if(Number(row.version_number)!==parsed.data.expectedVersion){
      await client.query('ROLLBACK');return NextResponse.json({error:'A newer revision exists. Reload before asking AI to edit.',currentVersion:Number(row.version_number)},{status:409});
    }
    const currentDefinition=definitionSchema.safeParse(row.definition_json||{});
    if(!currentDefinition.success){await client.query('ROLLBACK');return NextResponse.json({error:'The current draft structure needs repair before AI editing.'},{status:409});}
    await client.query('COMMIT');

    const model=process.env.CREATOR_AI_MODEL||process.env.AI_WORKFORCE_MODEL||'gpt-4.1-mini';
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model,temperature:0.3,response_format:{type:'json_object'},
        messages:[
          {role:'system',content:'You are DigiNanba Creator Assistant. Help a creator revise their own digital product based on their instruction. Return only a JSON object with keys title (string), description (string), definition (object with schemaVersion:1, editorProfile one of student|freelancer|homemaker|educator|designer|developer|other, description string, fields array). Each field has key (ASCII identifier starting with a letter, max 40 chars), label, type (text|number|date|select|checkbox|formula), required boolean, optional defaultValue/options/formula. Keep fields unique and no more than 100. Select fields must include options. Do not generate executable code, scripts, external actions, claims of professional certification, fabricated sources, or unsafe advice. Formula is stored as a reference and is not executed. Preserve the creator\'s intent and make a useful practical improvement. If instruction asks for a file format not supported by the schema, provide a structured outline and fields suitable for that product type.'},
          {role:'user',content:JSON.stringify({instruction:parsed.data.instruction,current:{title:row.title,description:row.description||'',buildKind:row.build_kind,definition:currentDefinition.data},constraints:'Return an improved draft structure. Do not publish it. Do not change price, market, owner, or permissions.'})}
        ]
      }),
      signal:AbortSignal.timeout(45000)
    });
    if(!response.ok){
      const provider=await response.json().catch(()=>({}));
      const status=response.status;
      const safeMessage=status===429?'AI provider rate limit or available API credits were reached. Your draft was not changed.':status===401?'The AI provider rejected its API credentials. Your draft was not changed.':'The AI provider could not complete this edit. Your draft was not changed.';
      console.error('Creator AI provider error',{status,code:(provider as any)?.error?.code});
      return NextResponse.json({error:safeMessage},{status:status===429?429:status===401?503:502});
    }
    const payload=await response.json() as any;
    const answer=payload.choices?.[0]?.message?.content;
    if(typeof answer!=='string') return NextResponse.json({error:'AI returned an empty response. Your draft was not changed.'},{status:502});
    let proposed:any;
    try{proposed=safeJson(answer)}catch{return NextResponse.json({error:'AI returned an invalid draft format. Your draft was not changed.'},{status:502});}
    const output=z.object({title:z.string().trim().min(3).max(120),description:z.string().trim().max(4000),definition:definitionSchema}).safeParse(proposed);
    if(!output.success) return NextResponse.json({error:'AI result failed structural validation. Your draft was not changed.'},{status:422});
    const keys=output.data.definition.fields.map(field=>field.key);
    if(new Set(keys).size!==keys.length||output.data.definition.fields.some(field=>field.type==='select'&&(!field.options||field.options.length===0))){
      return NextResponse.json({error:'AI result contains duplicate fields or incomplete select options. Your draft was not changed.'},{status:422});
    }
    const latest=await db.query(
      `SELECT p.status,p.moderation_status,b.version_number
       FROM products p JOIN LATERAL(SELECT version_number FROM product_builds WHERE product_id=p.id ORDER BY version_number DESC LIMIT 1)b ON true
       WHERE p.id=$1 AND p.creator_user_id=$2`,
      [productId,session.user.id]);
    if(!latest.rows[0]||latest.rows[0].status!=='draft'||Number(latest.rows[0].version_number)!==parsed.data.expectedVersion){
      return NextResponse.json({error:'The draft changed while AI was working. Reload it; the AI suggestion was not saved.'},{status:409});
    }
    const nextVersion=parsed.data.expectedVersion+1;
    const save=await db.connect();
    try{
      await save.query('BEGIN');
      const lock=await save.query(
        `SELECT p.id,p.status,p.moderation_status,b.version_number
         FROM products p JOIN LATERAL(SELECT version_number FROM product_builds WHERE product_id=p.id ORDER BY version_number DESC LIMIT 1)b ON true
         WHERE p.id=$1 AND p.creator_user_id=$2 FOR UPDATE OF p`,
        [productId,session.user.id]);
      if(!lock.rows[0]||lock.rows[0].status!=='draft'||Number(lock.rows[0].version_number)!==parsed.data.expectedVersion){
        await save.query('ROLLBACK');return NextResponse.json({error:'The draft changed while AI was working. Reload it; the AI suggestion was not saved.'},{status:409});
      }
      await save.query(
        `INSERT INTO product_builds(product_id,created_by,version_number,build_kind,editor_kind,definition_json,validation_json,status)
         VALUES($1,$2,$3,$4,'ai_assisted_builder',$5::jsonb,'{}'::jsonb,'draft')`,
        [productId,session.user.id,nextVersion,row.build_kind,JSON.stringify(output.data.definition)]);
      await save.query(`UPDATE products SET title=$2,description=$3,updated_at=now() WHERE id=$1`,[productId,output.data.title,output.data.description]);
      await save.query(
        `UPDATE product_editions SET title=$2,description=$3,status='draft'
         WHERE id=(SELECT id FROM product_editions WHERE product_id=$1 ORDER BY version DESC LIMIT 1)`,
        [productId,output.data.title,output.data.description]);
      await save.query(
        `INSERT INTO product_build_revision_events(product_id,product_build_id,actor_user_id,event_type,details_json)
         SELECT $1,id,$2,'saved_revision',$3::jsonb FROM product_builds WHERE product_id=$1 AND version_number=$4`,
        [productId,session.user.id,JSON.stringify({source:'creator_ai_assistant',model,instructionLength:parsed.data.instruction.length}),nextVersion]);
      await save.query('COMMIT');
    }catch(error){await save.query('ROLLBACK').catch(()=>undefined);throw error;}finally{save.release();}
    return NextResponse.json({message:'AI created a new private draft revision. Review it, edit anything needed, then confirm the version before submitting for moderation.',model,build:{version_number:nextVersion,status:'draft'},proposal:output.data});
  }catch(error){
    await client.query('ROLLBACK').catch(()=>undefined);
    console.error('Creator AI edit failed',error);
    return NextResponse.json({error:'AI editing could not be completed. Your existing draft remains unchanged.'},{status:503});
  }finally{client.release();}
}
