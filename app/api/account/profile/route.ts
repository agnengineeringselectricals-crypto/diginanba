import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const schema=z.object({displayName:z.string().trim().min(1).max(80)});

export async function GET(){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Authentication required'},{status:401});
  const r=await db.query('SELECT id,email,display_name,status,created_at FROM users WHERE id=$1 LIMIT 1',[session.user.id]);
  if(!r.rows[0])return NextResponse.json({error:'Account not found'},{status:404});
  return NextResponse.json({profile:r.rows[0]});
}
export async function PATCH(req:Request){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Authentication required'},{status:401});
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:'Enter a valid name.'},{status:400});
  const r=await db.query('UPDATE users SET display_name=$1,updated_at=now() WHERE id=$2 RETURNING id,email,display_name,status,created_at',[parsed.data.displayName,session.user.id]);
  return NextResponse.json({profile:r.rows[0]});
}
