import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
type Context = { params: Promise<{ productId:string }> };
const submitSchema = z.object({ action:z.literal('submit') });

function validateDefinition(definition: unknown, title: string, description: string) {
 const errors:string[]=[];
 const root=definition&&typeof definition==='object'?definition as Record<string,unknown>:{};
 const fields=Array.isArray(root.fields)?root.fields:[];
 if(title.trim().length<3)errors.push('Product title must contain at least 3 characters.');
 if(description.trim().length<20)errors.push('Add a description of at least 20 characters before review.');
 if(fields.length<1)errors.push('Add at least one structured preview field.');
 if(fields.length>100)errors.push('A build may contain no more than 100 fields.');
 const keys=new Set<string>();
 for(const [index,item] of fields.entries()){
  if(!item||typeof item!=='object'){errors.push('Field '+(index+1)+' is not a valid object.');continue;}
  const field=item as Record<string,unknown>;
  const key=typeof field.key==='string'?field.key:'';
  if(!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key))errors.push('Field '+(index+1)+' needs a valid key.');
  if(keys.has(key))errors.push('Field key "'+key+'" is duplicated.');
  keys.add(key);
  if(typeof field.label!=='string'||!field.label.trim()||field.label.length>80)errors.push('Field '+(index+1)+' needs a label up to 80 characters.');
  if(!['text','number','date','select','checkbox','formula'].includes(String(field.type)))errors.push('Field '+(index+1)+' has an unsupported type.');
  if(field.type==='select'&&(!Array.isArray(field.options)||field.options.length===0))errors.push('Select field "'+key+'" needs at least one option.');
  if(field.type==='formula'&&typeof field.formula==='string'&&field.formula.length>500)errors.push('Formula text for "'+key+'" is too long.');
 }
 return {valid:errors.length===0,errors,fieldCount:fields.length};
}

export async function GET(_request:Request,{params}:Context){
 const session=await auth();
 if(!session?.user?.id)return NextResponse.json({error:'Sign in to view your private draft.'},{status:401});
 const {productId}=await params;
 try{
  const result=await db.query(
   `SELECT p.id,p.slug,p.title,p.description,p.status,p.moderation_status,
           b.id AS build_id,b.version_number,b.build_kind,b.status AS build_status,b.definition_json,b.validation_json,
           pe.market_code,pe.locale,pe.title AS edition_title,pe.description AS edition_description
    FROM products p
    JOIN LATERAL(SELECT * FROM product_builds WHERE product_id=p.id ORDER BY version_number DESC LIMIT 1)b ON true
    LEFT JOIN LATERAL(SELECT * FROM product_editions WHERE product_id=p.id ORDER BY version DESC LIMIT 1)pe ON true
    WHERE p.id=$1 AND p.creator_user_id=$2 LIMIT 1`,
   [productId,session.user.id]);
  const row=result.rows[0];
  if(!row)return NextResponse.json({error:'Draft not found or you do not have access.'},{status:404});
  return NextResponse.json({product:{id:row.id,slug:row.slug,title:row.title,description:row.description,status:row.status,moderation_status:row.moderation_status},build:{id:row.build_id,version_number:row.version_number,build_kind:row.build_kind,status:row.build_status,definition_json:row.definition_json,validation_json:row.validation_json},edition:row.market_code?{market_code:row.market_code,locale:row.locale,title:row.edition_title,description:row.edition_description}:null});
 }catch(error){console.error('Creator preview load failed',error);return NextResponse.json({error:'Private preview is temporarily unavailable. Confirm creator marketplace migrations are applied.'},{status:503})}
}

export async function POST(request:Request,{params}:Context){
 const session=await auth();
 if(!session?.user?.id)return NextResponse.json({error:'Sign in to submit your draft.'},{status:401});
 const parsed=submitSchema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Invalid publication action.'},{status:400});
 const {productId}=await params;
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const result=await client.query(
   `SELECT p.id,p.title,p.description,p.status,p.moderation_status,b.id AS build_id,b.version_number,b.build_kind,b.definition_json
    FROM products p JOIN LATERAL(SELECT * FROM product_builds WHERE product_id=p.id ORDER BY version_number DESC LIMIT 1)b ON true
    WHERE p.id=$1 AND p.creator_user_id=$2 FOR UPDATE OF p`,
   [productId,session.user.id]);
  const row=result.rows[0];
  if(!row){await client.query('ROLLBACK');return NextResponse.json({error:'Draft not found or you do not have access.'},{status:404})}
  if(row.status!=='draft'){await client.query('ROLLBACK');return NextResponse.json({error:'Only unpublished drafts can be submitted for review.'},{status:409})}
  const check=validateDefinition(row.definition_json,row.title,row.description??'');
  await client.query('UPDATE product_builds SET validation_json=$2::jsonb,status=$3,updated_at=now() WHERE id=$1',[row.build_id,JSON.stringify(check),check.valid?'ready':'draft']);
  if(!check.valid){await client.query('COMMIT');return NextResponse.json({error:'The draft needs changes before review.',validation:check},{status:422})}
  const existing=await client.query(`SELECT id FROM product_publication_reviews WHERE product_id=$1 AND status IN ('submitted','in_review') LIMIT 1`,[productId]);
  if(existing.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'This product already has a review in progress.'},{status:409})}
  const review=await client.query(
   `INSERT INTO product_publication_reviews(product_id,product_build_id,submitted_by,status,checklist_json)
    VALUES($1,$2,$3,'submitted',$4::jsonb) RETURNING id,status,submitted_at`,
   [productId,row.build_id,session.user.id,JSON.stringify({basic_validation:check,private_preview_reviewed:true,creator_confirmation:true})]);
  await client.query(`UPDATE products SET moderation_status='pending',updated_at=now() WHERE id=$1`,[productId]);
  await client.query('COMMIT');
  return NextResponse.json({review:review.rows[0],validation:check,message:'Draft validated and submitted to DigiNanba moderation. It is not public yet.'},{status:201});
 }catch(error){await client.query('ROLLBACK').catch(()=>undefined);console.error('Creator publication submission failed',error);return NextResponse.json({error:'Could not submit the draft for review.'},{status:503})}
 finally{client.release()}
}
