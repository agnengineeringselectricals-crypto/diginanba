import 'server-only';
import { db } from '@/lib/db';

export async function getEntitledDownload(userId:string,downloadId:string){
  if(!/^[0-9a-f-]{36}$/i.test(downloadId))throw new Error('Invalid download id.');
  const result=await db.query(
    `SELECT d.id,d.asset_key,d.download_count,oi.order_id
     FROM downloads d
     JOIN order_items oi ON oi.id=d.order_item_id
     JOIN entitlements e ON e.order_item_id=oi.id AND e.user_id=$1 AND e.status='active'
     JOIN orders o ON o.id=oi.order_id AND o.user_id=$1 AND o.status='paid'
     WHERE d.id=$2 LIMIT 1`,[userId,downloadId]);
  return result.rows[0]??null;
}
export function assertSafeAssetKey(assetKey:string){
  if(!assetKey||assetKey.includes('..')||assetKey.startsWith('/')||/^[a-z]+:\\\//i.test(assetKey))throw new Error('Unsafe asset key.');
  return assetKey;
}
