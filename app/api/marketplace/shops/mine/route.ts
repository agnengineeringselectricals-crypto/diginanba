import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session=await auth();
  const userId=session?.user?.id;
  if(!userId)return NextResponse.json({error:'Please sign in.'},{status:401});
  try{
    const result=await db.query(
      `SELECT b.id,b.public_id,b.business_name,b.country_code,b.region_code,b.region,b.city,b.locality,b.address_line,b.phone,b.email,b.verification_status,b.average_rating,b.rating_count,b.door_delivery_enabled,b.self_collection_enabled,b.default_delivery_fee,
       COALESCE(json_agg(json_build_object('id',l.id,'title',l.title,'category',l.category,'priceAmount',COALESCE(l.customer_price_amount,l.price_amount),'mrpAmount',COALESCE(l.mrp_amount,l.price_amount),'maxDiscountAmount',l.max_discount_amount,'currency',l.currency,'priceUnit',l.price_unit,'availability',l.availability_status)) FILTER(WHERE l.id IS NOT NULL),'[]') AS listings
       FROM marketplace_businesses b LEFT JOIN marketplace_listings l ON l.business_id=b.id
       WHERE b.owner_user_id=$1 AND b.business_type='shop'
       GROUP BY b.id ORDER BY b.created_at DESC`,
      [userId]
    );
    return NextResponse.json({shops:result.rows});
  }catch(error){
    console.error('Load owner shops failed',error);
    return NextResponse.json({error:'Could not load your shops.'},{status:503});
  }
}

export async function PATCH(request:Request) {
  const session=await auth();
  const userId=session?.user?.id;
  if(!userId)return NextResponse.json({error:'Please sign in.'},{status:401});
  const body=await request.json().catch(()=>null);
  if(typeof body?.businessId!=='string')return NextResponse.json({error:'Shop not selected.'},{status:400});
  const sets:string[]=[];const values:unknown[]=[body.businessId,userId];
  if(typeof body.phone==='string'){values.push(body.phone.trim().slice(0,40)||null);sets.push('phone=$'+values.length);}
  if(typeof body.email==='string'){const email=body.email.trim().slice(0,254);if(email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});values.push(email||null);sets.push('email=$'+values.length);}
  if(typeof body.doorDeliveryEnabled==='boolean'){values.push(body.doorDeliveryEnabled);sets.push('door_delivery_enabled=$'+values.length);}
  if(typeof body.selfCollectionEnabled==='boolean'){values.push(body.selfCollectionEnabled);sets.push('self_collection_enabled=$'+values.length);}
  if(!sets.length)return NextResponse.json({error:'No shop settings were supplied.'},{status:400});
  sets.push('updated_at=now()');
  try{
    const result=await db.query('UPDATE marketplace_businesses SET '+sets.join(',')+' WHERE id=$1 AND owner_user_id=$2 AND business_type=\'shop\' RETURNING id,business_name,phone,email,door_delivery_enabled,self_collection_enabled',[...values]);
    if(!result.rowCount)return NextResponse.json({error:'Shop not found.'},{status:404});
    return NextResponse.json({shop:result.rows[0],message:'Shop settings updated.'});
  }catch(error){console.error('Update shop settings failed',error);return NextResponse.json({error:'Could not update shop settings.'},{status:503});}
}
