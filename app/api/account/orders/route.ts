import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(){
  const session=await auth(); if(!session?.user?.id)return NextResponse.json({error:'Authentication required'},{status:401});
  const r=await db.query(`SELECT o.id,o.market_code,o.currency_code,o.subtotal_minor,o.tax_minor,o.total_minor,o.status,o.created_at,
    COALESCE(json_agg(json_build_object('title',pe.title,'quantity',oi.quantity,'unitAmountMinor',oi.unit_amount_minor,'totalAmountMinor',oi.total_amount_minor)) FILTER (WHERE oi.id IS NOT NULL),'[]') items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN product_editions pe ON pe.id=oi.product_edition_id
    WHERE o.user_id=$1
    GROUP BY o.id
    ORDER BY o.created_at DESC LIMIT 100`,[session.user.id]);
  return NextResponse.json({orders:r.rows});
}
