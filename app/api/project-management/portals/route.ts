import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
const uuid = z.string().uuid();
const clean = (max=240) => z.string().trim().min(1).max(max);
const lineSchema = z.object({
  description: clean(500),
  specification: z.string().trim().max(1000).optional().default(''),
  unit: z.string().trim().max(40).optional().default('Nos'),
  quantity: z.number().positive().finite(),
  estimatedRate: z.number().nonnegative().finite().optional().default(0),
});

async function manager(userId:string) {
  const r=await db.query(
    `SELECT m.organization_id,m.role
     FROM organization_memberships m
     WHERE m.user_id=$1 AND m.status='active' AND m.role IN ('owner','admin')
     ORDER BY CASE WHEN m.role='owner' THEN 0 ELSE 1 END,m.created_at DESC LIMIT 1`,
    [userId],
  );
  return r.rows[0] as {organization_id:string;role:string}|undefined;
}

export async function GET() {
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:'Sign in required.'},{status:401});
  const access=await manager(session.user.id);
  if(!access) return NextResponse.json({error:'Organization owner or administrator access is required.'},{status:403});
  const org=access.organization_id;
  try {
    const [clients,suppliers,projects,members,enquiries,quotes]=await Promise.all([
      db.query(`SELECT id,client_code,legal_name,contact_name,email,phone,status FROM pm_clients WHERE organization_id=$1 ORDER BY legal_name`,[org]),
      db.query(`SELECT id,supplier_code,legal_name,contact_name,email,phone,tax_registration_number,status FROM pm_suppliers WHERE organization_id=$1 ORDER BY legal_name`,[org]),
      db.query(`SELECT p.id,p.project_code,p.name,p.status,pc.client_id,c.legal_name AS client_name FROM pm_projects p LEFT JOIN pm_project_clients pc ON pc.project_id=p.id AND pc.organization_id=p.organization_id LEFT JOIN pm_clients c ON c.id=pc.client_id AND c.organization_id=p.organization_id WHERE p.organization_id=$1 AND p.status<>'archived' ORDER BY p.created_at DESC`,[org]),
      db.query(`SELECT m.id,m.party_type,m.party_id,m.contact_name,m.email,m.status,m.invitation_expires_at,m.created_at,COALESCE(c.legal_name,s.legal_name) AS party_name FROM pm_external_portal_members m LEFT JOIN pm_clients c ON m.party_type='client' AND c.id=m.party_id AND c.organization_id=m.organization_id LEFT JOIN pm_suppliers s ON m.party_type='supplier' AND s.id=m.party_id AND s.organization_id=m.organization_id WHERE m.organization_id=$1 ORDER BY m.created_at DESC`,[org]),
      db.query(`SELECT e.id,e.project_id,e.enquiry_number,e.title,e.description,e.line_items,e.required_delivery_date,e.submission_deadline,e.status,e.created_at,p.name AS project_name,COUNT(DISTINCT i.supplier_id)::int AS invited_suppliers,COUNT(DISTINCT q.id)::int AS quote_count FROM pm_supplier_enquiries e JOIN pm_projects p ON p.id=e.project_id AND p.organization_id=e.organization_id LEFT JOIN pm_supplier_enquiry_invites i ON i.enquiry_id=e.id AND i.organization_id=e.organization_id LEFT JOIN pm_supplier_quotes q ON q.enquiry_id=e.id AND q.organization_id=e.organization_id WHERE e.organization_id=$1 GROUP BY e.id,p.name ORDER BY e.created_at DESC`,[org]),
      db.query(`SELECT q.id,q.enquiry_id,q.supplier_id,q.quote_number,q.currency_code,q.subtotal,q.tax_total,q.total_amount,q.delivery_days,q.valid_until,q.line_items,q.terms,q.status,q.submitted_at,s.legal_name AS supplier_name,e.enquiry_number,e.title AS enquiry_title FROM pm_supplier_quotes q JOIN pm_suppliers s ON s.id=q.supplier_id AND s.organization_id=q.organization_id JOIN pm_supplier_enquiries e ON e.id=q.enquiry_id AND e.organization_id=q.organization_id WHERE q.organization_id=$1 ORDER BY q.submitted_at DESC`,[org]),
    ]);
    return NextResponse.json({clients:clients.rows,suppliers:suppliers.rows,projects:projects.rows,portalMembers:members.rows,enquiries:enquiries.rows,quotes:quotes.rows});
  } catch(error) {
    console.error('Portal management load failed',error);
    return NextResponse.json({error:'Unable to load client and supplier workspace.'},{status:500});
  }
}

export async function POST(request:Request) {
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:'Sign in required.'},{status:401});
  const access=await manager(session.user.id);
  if(!access) return NextResponse.json({error:'Organization owner or administrator access is required.'},{status:403});
  const org=access.organization_id;
  const body=await request.json().catch(()=>null);
  if(!body || typeof body.action!=='string') return NextResponse.json({error:'Invalid request.'},{status:400});
  try {
    if(body.action==='create_client') {
      const v=z.object({legalName:clean(240),contactName:z.string().trim().max(160).optional(),email:z.string().email().optional().or(z.literal('')),phone:z.string().trim().max(40).optional(),clientCode:z.string().trim().max(40).optional()}).safeParse(body);
      if(!v.success) return NextResponse.json({error:'Enter a valid client name and contact details.'},{status:400});
      const r=await db.query(`INSERT INTO pm_clients(organization_id,client_code,legal_name,contact_name,email,phone) VALUES($1,NULLIF($2,''),$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,'')) RETURNING id,client_code,legal_name,contact_name,email,phone,status`,[org,v.data.clientCode||'',v.data.legalName,v.data.contactName||'',v.data.email||'',v.data.phone||'']);
      return NextResponse.json({client:r.rows[0]},{status:201});
    }
    if(body.action==='link_project') {
      const v=z.object({projectId:uuid,clientId:uuid}).safeParse(body);
      if(!v.success) return NextResponse.json({error:'Select a valid project and client.'},{status:400});
      const p=await db.query('SELECT id FROM pm_projects WHERE id=$1 AND organization_id=$2',[v.data.projectId,org]);
      const c=await db.query('SELECT id FROM pm_clients WHERE id=$1 AND organization_id=$2 AND status=\'active\'',[v.data.clientId,org]);
      if(!p.rows[0]||!c.rows[0]) return NextResponse.json({error:'Project or client not found.'},{status:404});
      await db.query(`INSERT INTO pm_project_clients(organization_id,project_id,client_id,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,project_id,client_id) DO NOTHING`,[org,v.data.projectId,v.data.clientId,session.user.id]);
      return NextResponse.json({ok:true});
    }
    if(body.action==='invite_portal_member') {
      const v=z.object({partyType:z.enum(['client','supplier']),partyId:uuid,contactName:clean(160),email:z.string().email(),permissions:z.record(z.string(),z.boolean()).optional()}).safeParse(body);
      if(!v.success) return NextResponse.json({error:'Enter a valid portal contact and email.'},{status:400});
      const table=v.data.partyType==='client'?'pm_clients':'pm_suppliers';
      const party=await db.query(`SELECT id FROM ${table} WHERE id=$1 AND organization_id=$2 AND status='active'`,[v.data.partyId,org]);
      if(!party.rows[0]) return NextResponse.json({error:'Client or supplier record not found.'},{status:404});
      const token=randomBytes(32).toString('base64url');
      const tokenHash=createHash('sha256').update(token).digest('hex');
      const r=await db.query(`INSERT INTO pm_external_portal_members(organization_id,party_type,party_id,contact_name,email,invitation_token_hash,invitation_expires_at,status,permissions) VALUES($1,$2,$3,$4,lower($5),$6,now()+interval '7 days','invited',$7::jsonb) ON CONFLICT (organization_id,party_type,party_id,lower(email)) DO UPDATE SET contact_name=EXCLUDED.contact_name,invitation_token_hash=EXCLUDED.invitation_token_hash,invitation_expires_at=EXCLUDED.invitation_expires_at,status='invited',user_id=NULL,permissions=EXCLUDED.permissions,updated_at=now() RETURNING id,email,party_type,status,invitation_expires_at`,[org,v.data.partyType,v.data.partyId,v.data.contactName,v.data.email,tokenHash,JSON.stringify(v.data.permissions||{view:true,respond:true,documents:true,communication:true})]);
      const baseUrl=process.env.NEXTAUTH_URL||process.env.AUTH_URL||'https://www.diginanba.com';
      return NextResponse.json({member:r.rows[0],invitationUrl:`${baseUrl.replace(/\/$/,'')}/portal/accept?token=${token}`},{status:201});
    }
    if(body.action==='create_enquiry') {
      const v=z.object({projectId:uuid,title:clean(240),description:z.string().trim().max(4000).optional(),items:z.array(lineSchema).min(1).max(100),requiredDeliveryDate:z.string().date().optional(),submissionDeadline:z.string().datetime().optional()}).safeParse(body);
      if(!v.success) return NextResponse.json({error:'Enter the enquiry details and at least one valid material line.'},{status:400});
      const project=await db.query('SELECT id FROM pm_projects WHERE id=$1 AND organization_id=$2',[v.data.projectId,org]);
      if(!project.rows[0]) return NextResponse.json({error:'Project not found.'},{status:404});
      const number=`RFQ-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const r=await db.query(`INSERT INTO pm_supplier_enquiries(organization_id,project_id,enquiry_number,title,description,line_items,required_delivery_date,submission_deadline,status,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,'draft',$9) RETURNING id,enquiry_number,title,status`,[org,v.data.projectId,number,v.data.title,v.data.description||'',JSON.stringify(v.data.items),v.data.requiredDeliveryDate||null,v.data.submissionDeadline||null,session.user.id]);
      return NextResponse.json({enquiry:r.rows[0]},{status:201});
    }
    if(body.action==='issue_enquiry') {
      const v=z.object({enquiryId:uuid,supplierIds:z.array(uuid).min(1).max(100)}).safeParse(body);
      if(!v.success) return NextResponse.json({error:'Select an enquiry and at least one supplier.'},{status:400});
      const e=await db.query(`SELECT id FROM pm_supplier_enquiries WHERE id=$1 AND organization_id=$2 AND status='draft'`,[v.data.enquiryId,org]);
      if(!e.rows[0]) return NextResponse.json({error:'Draft enquiry not found.'},{status:404});
      for(const supplierId of [...new Set(v.data.supplierIds)]) {
        const s=await db.query(`SELECT id FROM pm_suppliers WHERE id=$1 AND organization_id=$2 AND status='active'`,[supplierId,org]);
        if(s.rows[0]) await db.query(`INSERT INTO pm_supplier_enquiry_invites(organization_id,enquiry_id,supplier_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[org,v.data.enquiryId,supplierId]);
      }
      await db.query(`UPDATE pm_supplier_enquiries SET status='issued',updated_at=now() WHERE id=$1 AND organization_id=$2`,[v.data.enquiryId,org]);
      return NextResponse.json({ok:true});
    }
    if(body.action==='request_client_approval') {
      const v=z.object({projectId:uuid,clientId:uuid,documentId:uuid,title:clean(240)}).safeParse(body);
      if(!v.success) return NextResponse.json({error:'Select a project, client and document.'},{status:400});
      const [link,doc,members]=await Promise.all([
        db.query('SELECT 1 FROM pm_project_clients WHERE organization_id=$1 AND project_id=$2 AND client_id=$3',[org,v.data.projectId,v.data.clientId]),
        db.query('SELECT id,title,revision FROM pm_documents WHERE organization_id=$1 AND project_id=$2 AND id=$3',[org,v.data.projectId,v.data.documentId]),
        db.query(`SELECT id FROM pm_external_portal_members WHERE organization_id=$1 AND party_type='client' AND party_id=$2 AND status='active'`,[org,v.data.clientId]),
      ]);
      if(!link.rows[0]||!doc.rows[0]||!members.rows.length) return NextResponse.json({error:'The client must be linked to this project and have an active portal invitation.'},{status:400});
      const memberIds=members.rows.map((m:any)=>m.id);
      for(const memberId of memberIds) await db.query(`INSERT INTO pm_approval_requests(organization_id,project_id,entity_type,entity_id,approval_type,title,requested_by,metadata) VALUES($1,$2,'document',$3,'client_review',$4,$5,$6::jsonb)`,[org,v.data.projectId,v.data.documentId,v.data.title,session.user.id,JSON.stringify({portal_member_id:memberId,document_revision:doc.rows[0].revision})]);
      return NextResponse.json({ok:true,requested:memberIds.length});
    }
    return NextResponse.json({error:'Unsupported portal action.'},{status:400});
  } catch(error) {
    console.error('Portal management action failed',error);
    return NextResponse.json({error:'Unable to complete this portal action. Check required fields and try again.'},{status:500});
  }
}
