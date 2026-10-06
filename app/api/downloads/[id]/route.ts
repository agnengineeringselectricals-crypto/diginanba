import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertSafeAssetKey, getEntitledDownload } from '@/lib/server/delivery';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Authentication required'},{status:401});
  const {id}=await params;
  const download=await getEntitledDownload(session.user.id,id);
  if(!download)return NextResponse.json({error:'Download not found or not entitled'},{status:404});
  assertSafeAssetKey(download.asset_key);
  return NextResponse.json({error:'Digital storage delivery is not activated in this pre-launch build.',downloadId:download.id},{status:503});
}
