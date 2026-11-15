import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;
const uuid = z.string().uuid();
const allowedTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/csv',
]);
const maxBytes = 25 * 1024 * 1024;

async function projectAccess(projectId: string, userId: string, write = false) {
  const result = await db.query(
    `SELECT p.organization_id,
       (m.role IN ('owner','admin') OR EXISTS (
         SELECT 1 FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id
         WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active'
           AND xm.user_id=$2 AND xm.status='active' AND x.access_level='project_admin'
       )) AS can_manage
     FROM pm_projects p JOIN organization_memberships m ON m.organization_id=p.organization_id
     WHERE p.id=$1 AND p.status<>'archived' AND m.user_id=$2 AND m.status='active'
       AND (m.role IN ('owner','admin') OR EXISTS (
         SELECT 1 FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id
         WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active'
           AND xm.user_id=$2 AND xm.status='active'
       )) LIMIT 1`,
    [projectId,userId],
  );
  const row=result.rows[0];
  if (!row || (write && !row.can_manage)) return null;
  return row as {organization_id:string;can_manage:boolean};
}

export async function POST(request: Request, context: {params: Promise<{projectId:string}>}) {
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Sign in to upload project documents.'},{status:401});
  const {projectId}=await context.params;
  if(!uuid.safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
  const access=await projectAccess(projectId,session.user.id,true);
  if(!access)return NextResponse.json({error:'Only project managers and organization administrators can upload or revise controlled documents.'},{status:403});

  const form=await request.formData();
  const file=form.get('file');
  if(!(file instanceof File) || file.size===0)return NextResponse.json({error:'Choose a document file to upload.'},{status:400});
  if(file.size>maxBytes)return NextResponse.json({error:'Documents must be 25 MB or smaller.'},{status:413});
  const mimeType=file.type || 'application/octet-stream';
  if(!allowedTypes.has(mimeType))return NextResponse.json({error:'Unsupported file type. Upload PDF, Word, Excel, PowerPoint, JPG, PNG, WebP, TXT or CSV files.'},{status:415});

  const title=String(form.get('title')||'').trim();
  const documentType=String(form.get('documentType')||'').trim();
  const revision=String(form.get('revision')||'').trim();
  const documentNumber=String(form.get('documentNumber')||'').trim();
  const changeSummary=String(form.get('changeSummary')||'').trim();
  const documentId=String(form.get('documentId')||'').trim();
  if(title.length<1||title.length>240||documentType.length<1||documentType.length>80||revision.length<1||revision.length>40||documentNumber.length>80||changeSummary.length>2000)
    return NextResponse.json({error:'Check the document title, type, revision and change summary.'},{status:400});
  if(documentId&&!uuid.safeParse(documentId).success)return NextResponse.json({error:'Invalid document revision target.'},{status:400});

  const client=await db.connect();
  let uploadedPath:string|undefined;
  try{
    await client.query('BEGIN');
    let id=documentId;
    if(documentId){
      const existing=await client.query(`SELECT id FROM pm_documents WHERE id=$1 AND organization_id=$2 AND project_id=$3 FOR UPDATE`,[documentId,access.organization_id,projectId]);
      if(!existing.rows[0])throw new Error('The document to revise was not found in this project.');
    }else{
      const created=await client.query(`INSERT INTO pm_documents(organization_id,project_id,document_number,title,document_type,revision,storage_key,mime_type,file_size_bytes,status,uploaded_by) VALUES($1,$2,NULLIF($3,''),$4,$5,$6,'pending-upload',$7,$8,'draft',$9) RETURNING id`,[access.organization_id,projectId,documentNumber,title,documentType,revision,mimeType,file.size,session.user.id]);
      id=created.rows[0].id;
    }
    const pathname=`organizations/${access.organization_id}/projects/${projectId}/documents/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)}`;
    const blob=await put(pathname,file,{access:'private',addRandomSuffix:false,contentType:mimeType});
    uploadedPath=blob.pathname;
    if(documentId){
      await client.query(`INSERT INTO pm_document_versions(organization_id,document_id,revision,storage_key,mime_type,file_size_bytes,change_summary,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[access.organization_id,id,revision,uploadedPath,mimeType,file.size,changeSummary,session.user.id]);
      await client.query(`UPDATE pm_documents SET title=$3,document_type=$4,revision=$5,storage_key=$6,mime_type=$7,file_size_bytes=$8,status='draft',updated_at=now() WHERE organization_id=$1 AND id=$2`,[access.organization_id,id,title,documentType,revision,uploadedPath,mimeType,file.size]);
    }else{
      await client.query(`INSERT INTO pm_document_versions(organization_id,document_id,revision,storage_key,mime_type,file_size_bytes,change_summary,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[access.organization_id,id,revision,uploadedPath,mimeType,file.size,changeSummary||'Initial upload',session.user.id]);
      await client.query(`UPDATE pm_documents SET storage_key=$3 WHERE organization_id=$1 AND id=$2`,[access.organization_id,id,uploadedPath]);
    }
    await client.query(`INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,'document',$5,$6::jsonb)`,[access.organization_id,session.user.id,projectId,documentId?'documents.revision_uploaded':'documents.uploaded',id,JSON.stringify({title,documentType,revision,fileSizeBytes:file.size,mimeType})]);
    await client.query('COMMIT');
    return NextResponse.json({document:{id,title,documentType,revision,fileSizeBytes:file.size,mimeType,downloadUrl:`/api/project-management/${projectId}/documents/${id}`}}, {status:documentId?200:201});
  }catch(error){
    await client.query('ROLLBACK').catch(()=>undefined);
    if(uploadedPath)await del(uploadedPath,{access:'private'}).catch(()=>undefined);
    const message=error instanceof Error?error.message:'Could not upload the document.';
    console.error('Project document upload failed',error);
    return NextResponse.json({error:message},{status:400});
  }finally{client.release();}
}
