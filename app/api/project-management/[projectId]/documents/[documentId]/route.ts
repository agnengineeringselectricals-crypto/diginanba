import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime='nodejs';

export async function GET(request:Request,context:{params:Promise<{projectId:string;documentId:string}>}){
 const session=await auth();
 if(!session?.user?.id)return NextResponse.json({error:'Sign in to download project documents.'},{status:401});
 const {projectId,documentId}=await context.params;
 const result=await db.query(
  `SELECT d.organization_id,d.title,d.storage_key,d.mime_type,d.file_size_bytes,d.revision,v.storage_key AS version_storage_key,v.mime_type AS version_mime_type,v.file_size_bytes AS version_size,v.revision AS version_revision
     FROM pm_documents d
     JOIN pm_projects p ON p.id=d.project_id AND p.organization_id=d.organization_id
     LEFT JOIN organization_memberships m ON m.organization_id=p.organization_id AND m.user_id=$3 AND m.status='active'
     LEFT JOIN pm_document_versions v ON v.organization_id=d.organization_id AND v.document_id=d.id AND v.revision=$4
    WHERE d.id=$1 AND d.project_id=$2 AND p.status<>'archived'
      AND (m.role IN ('owner','admin') OR EXISTS (
        SELECT 1 FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id
        WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active' AND xm.user_id=$3 AND xm.status='active'
      ) OR EXISTS (
        SELECT 1 FROM pm_external_portal_members ep
        JOIN pm_project_clients pc ON pc.organization_id=ep.organization_id AND pc.client_id=ep.party_id
        WHERE ep.organization_id=p.organization_id AND ep.user_id=$3 AND ep.party_type='client'
          AND ep.status='active' AND COALESCE((ep.permissions->>'documents')::boolean,true)=true AND pc.project_id=p.id AND d.status='approved'
      ))
    LIMIT 1`,
  [documentId,projectId,session.user.id,new URL(request.url).searchParams.get('revision')],
 );
 const doc=result.rows[0];
 if(!doc || (new URL(request.url).searchParams.has('revision') && !doc.version_storage_key))return NextResponse.json({error:'Document or requested revision not found, or access denied.'},{status:404});
 const pathname=doc.version_storage_key||doc.storage_key;
 if(!pathname||pathname==='pending-upload'||!pathname.startsWith('organizations/'+doc.organization_id+'/projects/'+projectId+'/documents/'))return NextResponse.json({error:'This document has no valid private storage object.'},{status:404});
 try{
  const blob=await get(pathname,{access:'private'});
  if(!blob||blob.statusCode!==200||!blob.stream)return NextResponse.json({error:'Document file not found.'},{status:404});
  const title=String(doc.title||'document').replace(/[\r\n"]/g,'_');
  const filename=`${title.replace(/[^a-zA-Z0-9._-]/g,'_')}-rev-${doc.version_revision||doc.revision}`;
  return new Response(blob.stream,{headers:{
    'Content-Type':doc.version_mime_type||doc.mime_type||'application/octet-stream',
    'Content-Length':String(doc.version_size||doc.file_size_bytes||blob.blob.size),
    'Content-Disposition':`attachment; filename="${filename}"`,
    'X-Content-Type-Options':'nosniff',
    'Cache-Control':'private, no-store',
  }});
 }catch(error){console.error('Project document download failed',error);return NextResponse.json({error:'Could not retrieve this document.'},{status:503});}
}
