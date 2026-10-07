import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compare, hash } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const schema=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(8).max(128)});

export async function POST(req:Request){
  const session=await auth(); if(!session?.user?.id)return NextResponse.json({error:'Authentication required'},{status:401});
  const parsed=schema.safeParse(await req.json()); if(!parsed.success)return NextResponse.json({error:'New password must be at least 8 characters.'},{status:400});
  const r=await db.query('SELECT password_hash FROM users WHERE id=$1 LIMIT 1',[session.user.id]);
  const current=r.rows[0]?.password_hash;
  if(!current)return NextResponse.json({error:'This account uses social sign-in and does not have a password to change.'},{status:400});
  if(!(await compare(parsed.data.currentPassword,current)))return NextResponse.json({error:'Current password is incorrect.'},{status:400});
  const passwordHash=await hash(parsed.data.newPassword,12);
  await db.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[passwordHash,session.user.id]);
  return NextResponse.json({ok:true});
}
