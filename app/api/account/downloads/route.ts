import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(){
  const session=await auth(); if(!session?.user?.id)return NextResponse.json({error:'Authentication required'},{status:401});
  const r=await db.query(`SELECT d.id,d.download_count,d.last_downloaded_at,oi.order_id,pe.title,pe.version,o.status
    FROM downloads d JOIN order_items oi ON oi.id=d.order_item_id JOIN orders o ON o.id=oi.order_id
    JOIN product_editions pe ON pe.id=oi.product_edition_id
    WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100`,[session.user.id]);
  return NextResponse.json({downloads:r.rows});
}
