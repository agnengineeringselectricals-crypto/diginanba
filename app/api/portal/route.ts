import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime='nodejs';
const uuid=z.string().uuid();
const line=z.object({description:z.string().trim().min(1).max(500),specification:z.string().trim().max(1000).optional().default(''),unit:z.string().trim().max(40).optional().default('Nos'),quantity:z.number().positive().finite(),unitRate:z.number().nonnegative().finite(),taxRate:z.number().min(0).max(100).finite().optional().default(0),datasheetUrl:z.string().url().max(1000).optional()});

async function memberFor(userId:string) {
 const r=await db.query(`SELECT id,organization_id,party_type,party_id,contact_name,email,permissions
   FROM pm_external_portal_members ep WHERE user_id=$1 AND status='active' AND ((party_type='client' AND EXISTS(SELECT 1 FROM pm_clients c WHERE c.id=ep.party_id AND c.organization_id=ep.organization_id AND c.status='active')) OR (party_type='supplier' AND EXISTS(SELECT 1 FROM pm_suppliers s WHERE s.id=ep.party_id AND s.organization_id=ep.organization_id AND s.status='active'))) LIMIT 1`,[userId]);
 return r.rows[0] as any;
}

export async function GET() {
 const session=await auth();
 if(!session?.user?.id) return NextResponse.json({error:'Sign in to access your external portal.'},{status:401});
 const member=await memberFor(session.user.id);
 if(!member) return NextResponse.json({error:'No active client or supplier portal is linked to this account.'},{status:403});
 if(member.permissions?.view===false) return NextResponse.json({error:'Your portal account does not have viewing permission.'},{status:403});
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
   let milestones:any[]=[]; let documents:any[]=[]; let tasks:any[]=[]; let inspections:any[]=[]; let payments:any[]=[]; let versions:any[]=[]; let threads:any[]=[]; let messages:any[]=[]; let deliveries:any[]=[];
   if(ids.length) {
    const [m,d,t,q,p,v,th,msg,del]=await Promise.all([
     db.query(`SELECT project_id,id,name,description,baseline_date,forecast_date,actual_date,status FROM pm_project_milestones WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) ORDER BY baseline_date NULLS LAST`,[member.organization_id,ids]),
     db.query(`SELECT id,project_id,document_number,title,document_type,revision,mime_type,file_size_bytes,status,created_at FROM pm_documents WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) AND status='approved' ORDER BY created_at DESC LIMIT 300`,[member.organization_id,ids]),
     db.query(`SELECT project_id,task_code,title,status,progress_percent,planned_start_date,planned_end_date,forecast_end_date FROM pm_tasks WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) AND status<>'cancelled' ORDER BY planned_end_date NULLS LAST LIMIT 300`,[member.organization_id,ids]),
     db.query(`SELECT project_id,inspection_number,inspection_type,inspected_at,result,due_date,closed_at FROM pm_quality_inspections WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) ORDER BY inspected_at DESC NULLS LAST LIMIT 200`,[member.organization_id,ids]),
     db.query(`SELECT project_id,entry_number,entry_type,entry_date,description,amount,tax_amount,currency_code,status FROM pm_financial_entries WHERE organization_id=$1 AND project_id=ANY($2::uuid[]) AND party_type='client' AND party_id=$3 AND status IN ('approved','posted') ORDER BY entry_date DESC LIMIT 200`,[member.organization_id,ids,member.party_id]),
     db.query(`SELECT v.document_id,d.project_id,d.title AS document_title,v.revision,v.change_summary,v.created_at FROM pm_document_versions v JOIN pm_documents d ON d.id=v.document_id AND d.organization_id=v.organization_id WHERE v.organization_id=$1 AND d.project_id=ANY($2::uuid[]) AND d.status='approved' ORDER BY v.created_at DESC LIMIT 300`,[member.organization_id,ids]),
     db.query(`SELECT t.id,t.project_id,t.subject,t.status,t.created_at FROM pm_communication_threads t JOIN pm_communication_participants cp ON cp.thread_id=t.id AND cp.organization_id=t.organization_id WHERE t.organization_id=$1 AND t.project_id=ANY($2::uuid[]) AND t.thread_type='client' AND t.visibility='external_portal' AND cp.user_id=$3 ORDER BY t.updated_at DESC LIMIT 100`,[member.organization_id,ids,session.user.id]),
     db.query(`SELECT m.id,m.thread_id,m.body,m.created_at,u.display_name AS sender FROM pm_communication_messages m JOIN pm_communication_threads t ON t.id=m.thread_id AND t.organization_id=m.organization_id JOIN pm_communication_participants cp ON cp.thread_id=t.id AND cp.organization_id=t.organization_id LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.organization_id=$1 AND t.project_id=ANY($2::uuid[]) AND t.thread_type='client' AND t.visibility='external_portal' AND cp.user_id=$3 ORDER BY m.created_at ASC LIMIT 500`,[member.organization_id,ids,session.user.id]),
     db.query(`SELECT po.project_id,po.po_number,s.legal_name AS supplier_name,d.status,d.carrier,d.tracking_reference,d.estimated_arrival,d.created_at FROM pm_purchase_orders po JOIN pm_suppliers s ON s.id=po.supplier_id AND s.organization_id=po.organization_id JOIN pm_supplier_delivery_updates d ON d.purchase_order_id=po.id AND d.organization_id=po.organization_id WHERE po.organization_id=$1 AND po.project_id=ANY($2::uuid[]) ORDER BY d.created_at DESC LIMIT 200`,[member.organization_id,ids]),
    ]);
    milestones=m.rows;documents=d.rows;tasks=t.rows;inspections=q.rows;payments=p.rows;versions=v.rows;threads=th.rows;messages=msg.rows;deliveries=del.rows;
    if(member.permissions?.documents===false){documents=[];versions=[];}
    if(member.permissions?.communication===false){threads=[];messages=[];}
   }
   const clientApprovals=member.permissions?.documents===false?[]:approvals.rows;
   return NextResponse.json({partyType:'client',member:{contactName:member.contact_name,email:member.email},client:client.rows[0],projects:projects.rows,milestones,documents,tasks,approvals:clientApprovals,inspections,payments,versions,threads,messages,deliveries});
  }
  const [supplier,enquiries,quotes,purchaseOrders,purchaseOrderItems,deliveryUpdates]=await Promise.all([
   db.query('SELECT legal_name,supplier_code,category,specializations,website_url,contact_name,tax_registration_number,status FROM pm_suppliers WHERE id=$1 AND organization_id=$2',[member.party_id,member.organization_id]),
   db.query(`SELECT e.id,e.enquiry_number,e.title,e.description,e.line_items,e.required_delivery_date,e.submission_deadline,e.status,p.project_code,p.name AS project_name,i.response_status,i.response_note
     FROM pm_supplier_enquiry_invites i JOIN pm_supplier_enquiries e ON e.id=i.enquiry_id AND e.organization_id=i.organization_id
     JOIN pm_projects p ON p.id=e.project_id AND p.organization_id=e.organization_id
     WHERE i.organization_id=$1 AND i.supplier_id=$2 AND e.status='issued' AND i.response_status IN ('invited','viewed','quoted') ORDER BY e.created_at DESC`,[member.organization_id,member.party_id]),
   db.query(`SELECT id,enquiry_id,quote_number,currency_code,subtotal,tax_total,total_amount,delivery_days,valid_until,line_items,terms,status,submitted_at
     FROM pm_supplier_quotes WHERE organization_id=$1 AND supplier_id=$2 ORDER BY submitted_at DESC`,[member.organization_id,member.party_id]),
   db.query(`SELECT p.id,p.po_number,p.project_id,p.issue_date,p.expected_delivery_date,p.currency_code,p.total_amount,p.status,pr.project_code,pr.name AS project_name FROM pm_purchase_orders p JOIN pm_projects pr ON pr.id=p.project_id AND pr.organization_id=p.organization_id WHERE p.organization_id=$1 AND p.supplier_id=$2 AND p.status IN ('approved','sent','partially_received','received') ORDER BY p.created_at DESC LIMIT 100`,[member.organization_id,member.party_id]),
   db.query(`SELECT poi.id,poi.purchase_order_id,poi.line_number,poi.description,poi.specification,poi.unit,poi.ordered_quantity,poi.unit_rate,poi.tax_rate,poi.line_total FROM pm_purchase_order_items poi JOIN pm_purchase_orders po ON po.id=poi.purchase_order_id AND po.organization_id=poi.organization_id WHERE poi.organization_id=$1 AND po.supplier_id=$2 ORDER BY po.created_at DESC,poi.line_number`,[member.organization_id,member.party_id]),
   db.query(`SELECT d.id,d.purchase_order_id,d.status,d.carrier,d.tracking_reference,d.estimated_arrival,d.note,d.created_at,po.po_number FROM pm_supplier_delivery_updates d JOIN pm_purchase_orders po ON po.id=d.purchase_order_id AND po.organization_id=d.organization_id WHERE d.organization_id=$1 AND d.supplier_id=$2 ORDER BY d.created_at DESC LIMIT 200`,[member.organization_id,member.party_id]),
  ]);
  await db.query(`UPDATE pm_supplier_enquiry_invites SET response_status='viewed' WHERE organization_id=$1 AND supplier_id=$2 AND response_status='invited' AND enquiry_id IN (SELECT id FROM pm_supplier_enquiries WHERE organization_id=$1 AND status='issued')`,[member.organization_id,member.party_id]);
  const [threads,messages]=await Promise.all([
   db.query(`SELECT t.id,t.project_id,t.subject,t.status,t.created_at FROM pm_communication_threads t JOIN pm_communication_participants cp ON cp.thread_id=t.id AND cp.organization_id=t.organization_id WHERE t.organization_id=$1 AND t.thread_type='supplier' AND t.visibility='external_portal' AND cp.user_id=$2 ORDER BY t.updated_at DESC LIMIT 100`,[member.organization_id,session.user.id]),
   db.query(`SELECT m.id,m.thread_id,m.body,m.created_at,u.display_name AS sender FROM pm_communication_messages m JOIN pm_communication_threads t ON t.id=m.thread_id AND t.organization_id=m.organization_id JOIN pm_communication_participants cp ON cp.thread_id=t.id AND cp.organization_id=t.organization_id LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.organization_id=$1 AND t.thread_type='supplier' AND t.visibility='external_portal' AND cp.user_id=$2 ORDER BY m.created_at ASC LIMIT 500`,[member.organization_id,session.user.id]),
  ]);
  if(member.permissions?.communication===false){threads.rows.length=0;messages.rows.length=0;}
  return NextResponse.json({partyType:'supplier',member:{contactName:member.contact_name,email:member.email},supplier:supplier.rows[0],enquiries:enquiries.rows,quotes:quotes.rows,purchaseOrders:purchaseOrders.rows,purchaseOrderItems:purchaseOrderItems.rows,deliveryUpdates:deliveryUpdates.rows,threads:threads.rows,messages:messages.rows});
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
 if(member.permissions?.respond===false) return NextResponse.json({error:'Your portal account does not have response permission.'},{status:403});
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
   await db.query(`UPDATE pm_supplier_enquiry_invites SET response_status='quoted',response_note='' WHERE organization_id=$1 AND supplier_id=$2 AND enquiry_id=$3`,[member.organization_id,member.party_id,v.data.enquiryId]);
   return NextResponse.json({quote:r.rows[0]},{status:201});
  }
  if(body.action==='decline_enquiry' && member.party_type==='supplier') {
   const v=z.object({enquiryId:uuid,note:z.string().trim().max(1000).optional()}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Invalid enquiry.'},{status:400});
   const r=await db.query(`UPDATE pm_supplier_enquiry_invites SET response_status='declined',response_note=$4 WHERE organization_id=$1 AND supplier_id=$2 AND enquiry_id=$3 RETURNING id`,[member.organization_id,member.party_id,v.data.enquiryId,v.data.note||'']);
   if(!r.rowCount) return NextResponse.json({error:'Enquiry not found.'},{status:404});
   return NextResponse.json({ok:true});
  }
  if(body.action==='update_delivery' && member.party_type==='supplier') {
   const v=z.object({purchaseOrderId:uuid,status:z.enum(['acknowledged','preparing','dispatched','in_transit','delivered','delayed','cancelled']),carrier:z.string().trim().max(160).optional(),trackingReference:z.string().trim().max(240).optional(),estimatedArrival:z.string().date().optional(),note:z.string().trim().max(2000).optional()}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Enter a valid purchase-order delivery update.'},{status:400});
   const po=await db.query(`SELECT id FROM pm_purchase_orders WHERE id=$1 AND organization_id=$2 AND supplier_id=$3 AND status IN ('approved','sent','partially_received','received')`,[v.data.purchaseOrderId,member.organization_id,member.party_id]);
   if(!po.rows[0]) return NextResponse.json({error:'Purchase order not found or not yet released to the supplier.'},{status:404});
   const update=(await db.query(`INSERT INTO pm_supplier_delivery_updates(organization_id,purchase_order_id,supplier_id,status,carrier,tracking_reference,estimated_arrival,note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,status,created_at`,[member.organization_id,v.data.purchaseOrderId,member.party_id,v.data.status,v.data.carrier||'',v.data.trackingReference||'',v.data.estimatedArrival||null,v.data.note||'',session.user.id])).rows[0];
   await db.query(`INSERT INTO pm_portal_activity_events(organization_id,portal_member_id,event_type,entity_type,entity_id,details) VALUES($1,$2,'delivery_update','purchase_order',$3,$4::jsonb)`,[member.organization_id,member.id,v.data.purchaseOrderId,JSON.stringify({status:v.data.status,trackingReference:v.data.trackingReference||''})]);
   return NextResponse.json({deliveryUpdate:update},{status:201});
  }
  if(body.action==='reply_message') {
   if(member.permissions?.communication===false) return NextResponse.json({error:'Your portal account does not have communication permission.'},{status:403});
   const v=z.object({threadId:uuid,body:z.string().trim().min(1).max(5000)}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Enter a message.'},{status:400});
   const thread=await db.query(`SELECT t.id FROM pm_communication_threads t JOIN pm_communication_participants cp ON cp.thread_id=t.id AND cp.organization_id=t.organization_id
     WHERE t.id=$1 AND t.organization_id=$2 AND t.thread_type=$3 AND t.visibility='external_portal' AND t.status='open' AND cp.user_id=$4 LIMIT 1`,[v.data.threadId,member.organization_id,member.party_type,session.user.id]);
   if(!thread.rows[0]) return NextResponse.json({error:'This conversation is not available to your portal account.'},{status:404});
   const message=(await db.query(`INSERT INTO pm_communication_messages(organization_id,thread_id,sender_user_id,body) VALUES($1,$2,$3,$4) RETURNING id,created_at`,[member.organization_id,v.data.threadId,session.user.id,v.data.body])).rows[0];
   await db.query(`UPDATE pm_communication_threads SET updated_at=now() WHERE id=$1 AND organization_id=$2`,[v.data.threadId,member.organization_id]);
   return NextResponse.json({message},{status:201});
  }
  if(body.action==='send_message') {
   if(member.permissions?.communication===false) return NextResponse.json({error:'Your portal account does not have communication permission.'},{status:403});
   const v=z.object({projectId:uuid.optional(),enquiryId:uuid.optional(),subject:z.string().trim().min(3).max(200),body:z.string().trim().min(1).max(5000)}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Enter a subject and message.'},{status:400});
   let projectId:string|null=null;
   if(member.party_type==='client') {
    if(!v.data.projectId) return NextResponse.json({error:'Select one of your shared projects.'},{status:400});
    const allowed=await db.query('SELECT project_id FROM pm_project_clients WHERE organization_id=$1 AND client_id=$2 AND project_id=$3',[member.organization_id,member.party_id,v.data.projectId]);
    if(!allowed.rows[0]) return NextResponse.json({error:'This project is not shared with your client account.'},{status:404});
    projectId=v.data.projectId;
   } else {
    if(!v.data.enquiryId) return NextResponse.json({error:'Select an assigned supplier enquiry.'},{status:400});
    const allowed=await db.query(`SELECT e.project_id FROM pm_supplier_enquiry_invites i JOIN pm_supplier_enquiries e ON e.id=i.enquiry_id AND e.organization_id=i.organization_id WHERE i.organization_id=$1 AND i.supplier_id=$2 AND i.enquiry_id=$3`,[member.organization_id,member.party_id,v.data.enquiryId]);
    if(!allowed.rows[0]) return NextResponse.json({error:'This enquiry is not assigned to your supplier account.'},{status:404});
    projectId=allowed.rows[0].project_id;
   }
   const project=await db.query(`SELECT project_manager_membership_id FROM pm_projects WHERE id=$1 AND organization_id=$2`,[projectId,member.organization_id]);
   const thread=(await db.query(`INSERT INTO pm_communication_threads(organization_id,project_id,subject,thread_type,visibility,status,created_by) VALUES($1,$2,$3,$4,'external_portal','open',$5) RETURNING id`,[member.organization_id,projectId,v.data.subject,member.party_type,session.user.id])).rows[0];
   await db.query(`INSERT INTO pm_communication_participants(organization_id,thread_id,user_id,participant_role) VALUES($1,$2,$3,'external')`,[member.organization_id,thread.id,session.user.id]);
   const managerMembership=project.rows[0]?.project_manager_membership_id;
   if(managerMembership) await db.query(`INSERT INTO pm_communication_participants(organization_id,thread_id,user_id,participant_role) SELECT $1,$2,m.user_id,'project_manager' FROM pm_memberships m WHERE m.organization_id=$1 AND m.id=$3 AND m.user_id IS NOT NULL`,[member.organization_id,thread.id,managerMembership]);
   const message=(await db.query(`INSERT INTO pm_communication_messages(organization_id,thread_id,sender_user_id,body) VALUES($1,$2,$3,$4) RETURNING id,created_at`,[member.organization_id,thread.id,session.user.id,v.data.body])).rows[0];
   await db.query(`UPDATE pm_communication_threads SET updated_at=now() WHERE id=$1 AND organization_id=$2`,[thread.id,member.organization_id]);
   await db.query(`INSERT INTO pm_portal_activity_events(organization_id,portal_member_id,project_id,event_type,entity_type,entity_id,details) VALUES($1,$2,$3,'message_sent','communication_thread',$4,$5::jsonb)`,[member.organization_id,member.id,projectId,thread.id,JSON.stringify({subject:v.data.subject})]);
   return NextResponse.json({threadId:thread.id,message},{status:201});
  }
  if(body.action==='client_decision' && member.party_type==='client') {
   if(member.permissions?.documents===false) return NextResponse.json({error:'Your portal account does not have document approval permission.'},{status:403});
   const v=z.object({approvalId:uuid,decision:z.enum(['approved','rejected']),note:z.string().trim().max(2000).optional(),signerName:z.string().trim().min(2).max(160),confirm:z.literal(true)}).safeParse(body);
   if(!v.success) return NextResponse.json({error:'Enter your name and confirm the electronic approval declaration.'},{status:400});
   const forwarded=request.headers.get('x-forwarded-for');
   const signerIp=request.headers.get('x-real-ip')||(forwarded?forwarded.split(',')[0].trim():'');
   const signature={decision_note:v.data.note||'',decided_by_portal_member:member.id,signer_name:v.data.signerName,signer_email:member.email,signed_at:new Date().toISOString(),signer_ip:signerIp,signer_user_agent:request.headers.get('user-agent')||'',signature_declaration:'I confirm that I am authorised to record this project document decision on behalf of the client.'};
   const r=await db.query(`UPDATE pm_approval_requests a SET status=$4,completed_at=now(),metadata=a.metadata || $5::jsonb
     FROM pm_project_clients pc
     WHERE a.id=$1 AND a.organization_id=$2 AND a.project_id=pc.project_id AND pc.organization_id=a.organization_id AND pc.client_id=$3
       AND a.metadata->>'portal_member_id'=$6 AND a.status='pending' AND a.approval_type='client_review'
     RETURNING a.id,a.status,a.completed_at`,[v.data.approvalId,member.organization_id,member.party_id,v.data.decision,JSON.stringify(signature),member.id]);
   if(!r.rows[0]) return NextResponse.json({error:'Approval request is no longer available to this client.'},{status:404});
   return NextResponse.json({approval:r.rows[0]});
  }
  return NextResponse.json({error:'This action is not available for your portal role.'},{status:403});
 } catch(error) {
  console.error('External portal action failed',error);
  return NextResponse.json({error:'Unable to submit this portal action. Please check the details and try again.'},{status:500});
 }
}
