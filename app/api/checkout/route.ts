import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createPendingOrder } from '@/lib/server/checkout';
const schema=z.object({market:z.enum(['US','UK']),items:z.array(z.object({slug:z.string().min(1),quantity:z.number().int().min(1).max(10)})).min(1)});
export async function POST(req:Request){
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:'Authentication required'},{status:401});
  try { const body=schema.parse(await req.json()); const order=await createPendingOrder(session.user.id,body.market,body.items); return NextResponse.json({orderId:order.id,currency:order.currency,subtotalMinor:order.subtotalMinor,paymentMode:'demo'}); }
  catch(e:any){return NextResponse.json({error:e?.message||'Checkout failed'},{status:400});}
}
