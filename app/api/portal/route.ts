import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime='nodejs';
const uuid=z.string().uuid();
const line=z.object({description:z.string().trim().min(1).max(500),specification:z.string().trim().max(1000).optional().default(''),unit:z.string().trim().max(40).optional().default('Nos'),quantity:z.number().positive().finite(),unitRate:z.number().nonnegative().finite(),taxRate:z.number().min(0).max(100).finite().optional().default(0)});

async function memberFor(userId:string) {
 const r=await db.query(`SELECT id,organization_id,party_type,party_id,contact_name,email,permissions
   FROM pm_external_portal_members WHERE user_id=$1 AND status='active' LIMIT 1`,[userId]);
 return r.rows[0] as any;
}

export async function GET() {
 const session=await auth();
 if(!session?.user?.id) return NextResponse.json({error:'Sign in to access your external portal.'},{status:401});
 const member=await memberFor(session.user.id);
 if(!member) return NextResponse.json({error:'No active client or supplier portal is linked to this account.'},{status:403});
 try {
  if(member.party_type==='client') {
   const [client,projects,approvals]=await Promise.all([
    db.query('SELECT legal_name,client_code,contact_name FROM pm_clients WHERE id=$1 AND organization_id=$2',[member.party_id,member.organization_id]),
    db.query(`SELECT p.id,p.project_code,p.name,p.description,p.status,p.progress_percent,p.currency_code,p.baseline_start_date,p.baseline_end_date,p.forecast_end_date
      FROM pm_project_clients pc JOIN pm_projects p ON p.id=pc.project_id AND p.organization_id=pc.organization_id
      WHERE pc.organization_id=$1 AND pc.client_id=$2 ORDER BY p.created_at DESC`,[member.organization_id,member.party_id]),
    db.query(`SELECT a.id,a.project_id,a.title,a.approval_type,a.status,a.requested_at,a.completed_at,a.metadata,
        d.document_number,d.title AS document_title,d.revision,d.status AS document_status
      FROM pm_approval_requests a LEFT JOIN pm_documents d ON a.entity_type='document' AND d.id=a.entity_id AND d.organization_id=a.organization_id
      WHERE a.organization_id=$1 AND a.metadata->>'portal_member_id'=$2 ORDER BY a.requested_at DESC LIMIT 100`,[member.organization_id,member.id]),
   ]);
   const ids=projects.rows.map((p:any)=>p.id);
   let milestones:any[]=[]; let documents:any[]=[]; let tasks:any[]=[];
   if(ids.length) {
    const [m,d,t]=await Promise.all([
     db.query(`SELECT project_id,id,name,description,baseline_date,forecast_date,actual_date,status FROM pm_project_milestones WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) ORDER BY baseline_date NULLS LAST`,[member.organization_id,ids]),
     db.query(`SELECT id,project_id,document_number,title,document_type,revision,mime_type,file_size_bytes,status,created_at FROM pm_documents WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) AND status='approved' ORDER BY created_at DESC LIMIT 300`,[member.organization_id,ids]),
     db.query(`SELECT project_id,task_code,title,status,progress_percent,planned_start_date,planned_end_date,forecast_end_date FROM pm_tasks WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) AND status<>'cancelled' ORDER BY planned_end_date NULLS LAST LIMIT 300`,[member.organization_id,ids]),
    ]);
    milestones=m.rows;documents=d.rows;tasks=t.rows;
   }
   return NextResponse.json({partyType:'client',member:{contactName:member.contact_name,email:member.email},client:client.rows[0],projects:projects.rows,milestones,documents,tasks,approvals:approvals.rows});
  }
  const [supplier,enquiries,quotes]=await Promise.all([
   db.query('SELECT legal_name,supplier_code,contact_name,tax_registration_number,status FROM pm_suppliers WHERE id=$1 AND organization_id=$2',[member.party_id,member.organization_id]),
   db.query(`SELECT e.id,e.enquiry_number,e.title,e.description,e.line_items,e.required_delivery_date,e.submission_deadline,e.status,p.project_code,p.name AS project_name,i.response_status,i.response_note
     FROM pm_supplier_enquiry_invites i JOIN pm_supplier_enquiries e ON e.id=i.enquiry_id AND e.organization_id=i.organization_id
     JOIN pm_projects p ON p.id=e.project_id AND p.organization_id=e.organization_id
     WHERE i.organization_id=$1 AND i.supplier_id=$2 AND e.status='issued' ORDER BY e.created_at DESC`,[member.organization_id,member.party_id]),
   db.query(`SELECT id,enquiry_id,quote_number,currency_code,subtotal,tax_total,total_amount,delivery_days,valid_until,line_items,terms,status,submitted_at
     FROM pm_supplier_quotes WHERE organization_id=$1 AND supplier_id=$2 ORDER BY submitted_at DESC`,[member.organization_id,member.party_id]),
  ]);
  return NextResponse.json({partyType:'supplier',member:{contactName:member.contact_name,email:member.email},supplier:supplier.rows[0],enquiries:enquiries.rows,quotes:quotes.rows});
 } catch(error) {
  console.error('External portal load failed',error);
  return NextResponse.json({error:'Unable to load your portal workspace.'},{status:500});
 }
}

export async function POST(request:Request) {
 const session=await auth();
 if(!session?.user?.id) return NextResponse.json({error:'Sign in required.'},{status:401});
 const member=await memberFor(session.user.id);
 if(!member) return NextResponse.json({error:'No active portal access is linked to this account.'},{status:403});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.action!=='string') return NextResponse.json({error:'Invalid request.'},{status:400});
 try {
  if(body.action==='submit_quote' && member.party_type==='supplier') {
   const v=z.object({enquiryId:uuid,currencyCode:z.string().trim().length(3).default('INR'),items:z.array(line).min(1).max(100),deliveryDays:z.number().int().nonnegative().optional(),validUntil:z.string().date().optional(),terms:z.string().trim().max(4000).optional()}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Enter valid quotation line items, prices and delivery details.'},{status:400});
   const invite=await db.query(`SELECT e.id,e.submission_deadline FROM pm_supplier_enquiry_invites i JOIN pm_supplier_enquiries e ON e.id=i.enquiry_id AND e.organization_id=i.organization_id WHERE i.organization_id=$1 AND i.supplier_id=$2 AND i.enquiry_id=$3 AND e.status='issued'`,[member.organization_id,member.party_id,v.data.enquiryId]);
   if(!invite.rows[0]) return NextResponse.json({error:'This enquiry is not available to your supplier account.'},{status:404});
   if(invite.rows[0].submission_deadline && new Date(invite.rows[0].submission_deadline)<new Date()) return NextResponse.json({error:'The quotation submission deadline has passed.'},{status:409});
   const subtotal=v.data.items.reduce((s,i)=>s+i.quantity*i.unitRate,0);
   const taxTotal=v.data.items.reduce((s,i)=>s+i.quantity*i.unitRate*i.taxRate/100,0);
   const quoteNumber=`Q-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomBytes(3).toString('hex').toUpperCase()}`;
   const r=await db.query(`INSERT INTO pm_supplier_quotes(organization_id,enquiry_id,supplier_id,quote_number,currency_code,subtotal,tax_total,total_amount,delivery_days,valid_until,line_items,terms,status,submitted_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,'submitted',$13)
     ON CONFLICT(organization_id,enquiry_id,supplier_id) DO UPDATE SET quote_number=EXCLUDED.quote_number,currency_code=EXCLUDED.currency_code,subtotal=EXCLUDED.subtotal,tax_total=EXCLUDED.tax_total,total_amount=EXCLUDED.total_amount,delivery_days=EXCLUDED.delivery_days,valid_until=EXCLUDED.valid_until,line_items=EXCLUDED.line_items,terms=EXCLUDED.terms,status='submitted',submitted_by=EXCLUDED.submitted_by,submitted_at=now(),updated_at=now()
     RETURNING id,quote_number,total_amount,currency_code,status`,[member.organization_id,v.data.enquiryId,member.party_id,quoteNumber,v.data.currencyCode.toUpperCase(),subtotal,taxTotal,subtotal+taxTotal,v.data.deliveryDays??null,v.data.validUntil??null,JSON.stringify(v.data.items),v.data.terms||'',session.user.id]);
   await db.query(`UPDATE pm_supplier_enquiry_invites SET response_status='quoted',response_note='',WHERE organization_id=$1 AND supplier_id=$2 AND enquiry_id=$3`.replace("response_note='',WHERE","response_note='' WHERE"),[member.organization_id,member.party_id,v.data.enquiryId]);
   return NextResponse.json({quote:r.rows[0]},{status:201});
  }
  if(body.action==='decline_enquiry' && member.party_type==='supplier') {
   const v=z.object({enquiryId:uuid,note:z.string().trim().max(1000).optional()}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Invalid enquiry.'},{status:400});
   const r=await db.query(`UPDATE pm_supplier_enquiry_invites SET response_status='declined',response_note=$4 WHERE organization_id=$1 AND supplier_id=$2 AND enquiry_id=$3 RETURNING id`,[member.organization_id,member.party_id,v.data.enquiryId,v.data.note||'']);
   if(!r.rowCount) return NextResponse.json({error:'Enquiry not found.'},{status:404});
   return NextResponse.json({ok:true});
  }
  if(body.action==='client_decision' && member.party_type==='client') {
   const v=z.object({approvalId:uuid,decision:z.enum(['approved','rejected']),note:z.string().trim().max(2000).optional()}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Choose approve or reject and provide an optional note.'},{status:400});
   const r=await db.query(`UPDATE pm_approval_requests a SET status=$4,completed_at=now(),metadata=a.metadata || $5::jsonb
     FROM pm_project_clients pc
     WHERE a.id=$1 AND a.organization_id=$2 AND a.project_id=pc.project_id AND pc.organization_id=a.organization_id AND pc.client_id=$3
       AND a.metadata->>'portal_member_id'=$6 AND a.status='pending' AND a.approval_type='client_review'
     RETURNING a.id,a.status,a.completed_at`,[v.data.approvalId,member.organization_id,member.party_id,v.data.decision,JSON.stringify({decision_note:v.data.note||'',decided_by_portal_member:member.id}),member.id]);
   if(!r.rows[0]) return NextResponse.json({error:'Approval request is no longer available to this client.'},{status:404});
   return NextResponse.json({approval:r.rows[0]});
  }
  return NextResponse.json({error:'This action is not available for your portal role.'},{status:403});
 } catch(error) {
  console.error('External portal action failed',error);
  return NextResponse.json({error:'Unable to submit this portal action. Please check the details and try again.'},{status:500});
 }
}
