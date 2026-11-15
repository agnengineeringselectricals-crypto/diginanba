import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const uuid = z.string().uuid();
const text = (max = 240) => z.string().trim().min(1).max(max);
const amount = z.number().finite().nonnegative();
const base = z.object({ module: z.enum(['procurement','manpower','quality','finance','documents']) });

async function projectAccess(projectId: string, userId: string, write = false) {
  const result = await db.query(
    `SELECT p.organization_id,
       (SELECT x.access_level FROM pm_project_members x JOIN pm_memberships xm ON xm.id=x.membership_id WHERE x.project_id=p.id AND x.organization_id=p.organization_id AND x.status='active' AND xm.user_id=$2 AND xm.status='active' LIMIT 1) AS project_access,
       (SELECT xm.id FROM pm_memberships xm WHERE xm.organization_id=p.organization_id AND xm.user_id=$2 AND xm.status='active' LIMIT 1) AS actor_membership_id,
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
  return row as {organization_id:string;can_manage:boolean;project_access:string|null;actor_membership_id:string|null};
}

export async function GET(request: Request, context: {params: Promise<{projectId:string}>}) {
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:'Sign in to access project operations.'},{status:401});
  const {projectId}=await context.params;
  if(!uuid.safeParse(projectId).success) return NextResponse.json({error:'Invalid project.'},{status:400});
  const access=await projectAccess(projectId,session.user.id);
  if(!access) return NextResponse.json({error:'Project not found or access denied.'},{status:404});
  const org=access.organization_id;
  try {
    const [suppliers,indents,orders,receipts,receiptItems,purchaseOrderItems,resources,allocations,assignments,timesheets,inspections,ncs,budgets,entries,documents,documentVersions,members,tasks]=await Promise.all([
      db.query(`SELECT id,supplier_code,legal_name,contact_name,email,phone,tax_registration_number,status FROM pm_suppliers WHERE organization_id=$1 ORDER BY legal_name LIMIT 300`,[org]),
      db.query(`SELECT i.id,i.indent_number,i.required_by,i.status,i.purpose,i.created_at,u.display_name AS requester,COUNT(ii.id)::int AS line_count,COALESCE(SUM(ii.target_quantity*COALESCE(ii.estimated_rate,0)),0)::numeric AS estimated_total FROM pm_material_indents i LEFT JOIN users u ON u.id=i.requested_by LEFT JOIN pm_material_indent_items ii ON ii.indent_id=i.id AND ii.organization_id=i.organization_id WHERE i.organization_id=$1 AND i.project_id=$2 GROUP BY i.id,u.display_name ORDER BY i.created_at DESC LIMIT 100`,[org,projectId]),
      db.query(`SELECT p.id,p.po_number,p.issue_date,p.expected_delivery_date,p.currency_code,p.total_amount,p.status,s.legal_name AS supplier FROM pm_purchase_orders p JOIN pm_suppliers s ON s.id=p.supplier_id AND s.organization_id=p.organization_id WHERE p.organization_id=$1 AND p.project_id=$2 ORDER BY p.created_at DESC LIMIT 100`,[org,projectId]),
      db.query(`SELECT g.id,g.receipt_number,g.received_at,g.status,g.notes,p.id AS purchase_order_id,p.po_number,COUNT(gi.receipt_id)::int AS line_count,COALESCE(SUM(gi.received_quantity),0)::numeric AS received_quantity,COALESCE(SUM(gi.accepted_quantity),0)::numeric AS accepted_quantity,COALESCE(SUM(gi.rejected_quantity),0)::numeric AS rejected_quantity FROM pm_goods_receipts g JOIN pm_purchase_orders p ON p.id=g.purchase_order_id AND p.organization_id=g.organization_id LEFT JOIN pm_goods_receipt_items gi ON gi.receipt_id=g.id AND gi.organization_id=g.organization_id WHERE g.organization_id=$1 AND p.project_id=$2 GROUP BY g.id,p.id ORDER BY g.created_at DESC LIMIT 100`,[org,projectId]),
      db.query(`SELECT gi.id,gi.receipt_id,gi.purchase_order_item_id,gi.received_quantity,gi.accepted_quantity,gi.rejected_quantity,gi.remarks,poi.description,poi.unit,gr.receipt_number,po.po_number FROM pm_goods_receipt_items gi JOIN pm_goods_receipts gr ON gr.id=gi.receipt_id AND gr.organization_id=gi.organization_id JOIN pm_purchase_orders po ON po.id=gr.purchase_order_id AND po.organization_id=gr.organization_id JOIN pm_purchase_order_items poi ON poi.id=gi.purchase_order_item_id AND poi.organization_id=gi.organization_id WHERE gi.organization_id=$1 AND po.project_id=$2 ORDER BY gr.created_at DESC,poi.line_number`,[org,projectId]),
      db.query(`SELECT poi.id,poi.purchase_order_id,po.po_number,poi.line_number,poi.description,poi.specification,poi.unit,poi.ordered_quantity,poi.received_quantity,poi.unit_rate,poi.line_total FROM pm_purchase_order_items poi JOIN pm_purchase_orders po ON po.id=poi.purchase_order_id AND po.organization_id=poi.organization_id WHERE poi.organization_id=$1 AND po.project_id=$2 ORDER BY po.created_at DESC,poi.line_number`,[org,projectId]),
      db.query(`SELECT id,resource_code,name,resource_class,unit,capacity,cost_rate,currency_code,status FROM pm_resources WHERE organization_id=$1 ORDER BY name LIMIT 300`,[org]),
      db.query(`SELECT a.id,a.start_at,a.finish_at,a.planned_quantity,a.actual_quantity,a.status,a.notes,r.name AS resource,r.resource_class FROM pm_resource_allocations a JOIN pm_resources r ON r.id=a.resource_id AND r.organization_id=a.organization_id WHERE a.organization_id=$1 AND a.project_id=$2 ORDER BY a.created_at DESC LIMIT 100`,[org,projectId]),
      db.query(`SELECT w.id,w.role_on_project,w.planned_start,w.planned_finish,w.actual_start,w.actual_finish,w.planned_hours,w.actual_hours,w.status,w.notes,m.id AS membership_id,u.display_name,u.email FROM pm_workforce_assignments w JOIN pm_memberships m ON m.id=w.membership_id AND m.organization_id=w.organization_id JOIN users u ON u.id=m.user_id WHERE w.organization_id=$1 AND w.project_id=$2 ORDER BY w.created_at DESC LIMIT 200`,[org,projectId]),
      db.query(`SELECT t.id,t.period_start,t.period_end,t.status,t.submitted_at,t.approved_at,u.display_name,COALESCE(SUM(e.hours),0)::numeric AS total_hours,COUNT(e.id)::int AS entry_count FROM pm_timesheets t JOIN pm_memberships m ON m.id=t.membership_id AND m.organization_id=t.organization_id JOIN users u ON u.id=m.user_id JOIN pm_timesheet_entries e ON e.timesheet_id=t.id AND e.organization_id=t.organization_id AND e.project_id=$2 WHERE t.organization_id=$1 GROUP BY t.id,u.display_name ORDER BY t.created_at DESC LIMIT 200`,[org,projectId]),
      db.query(`SELECT id,inspection_number,inspection_type,inspected_at,result,findings,corrective_action,due_date,closed_at FROM pm_quality_inspections WHERE organization_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 150`,[org,projectId]),
      db.query(`SELECT n.id,n.nc_number,n.title,n.description,n.severity,n.status,n.due_date,u.display_name AS assigned_name,COUNT(a.id)::int AS action_count FROM pm_quality_nonconformities n LEFT JOIN pm_memberships m ON m.id=n.assigned_to_membership_id AND m.organization_id=n.organization_id LEFT JOIN users u ON u.id=m.user_id LEFT JOIN pm_quality_actions a ON a.nonconformity_id=n.id AND a.organization_id=n.organization_id WHERE n.organization_id=$1 AND n.project_id=$2 GROUP BY n.id,u.display_name ORDER BY n.created_at DESC LIMIT 150`,[org,projectId]),
      db.query(`SELECT id,budget_name,currency_code,baseline_amount,revised_amount,committed_amount,actual_amount,status FROM pm_project_budgets WHERE organization_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 150`,[org,projectId]),
      db.query(`SELECT id,entry_number,entry_type,entry_date,description,account_code,party_type,currency_code,amount,tax_amount,status FROM pm_financial_entries WHERE organization_id=$1 AND project_id=$2 ORDER BY entry_date DESC,created_at DESC LIMIT 200`,[org,projectId]),
      db.query(`SELECT d.id,d.document_number,d.title,d.document_type,d.revision,d.mime_type,d.file_size_bytes,d.status,d.created_at,u.display_name AS uploader, (SELECT COUNT(*)::int FROM pm_document_versions v WHERE v.document_id=d.id AND v.organization_id=d.organization_id) AS version_count FROM pm_documents d JOIN users u ON u.id=d.uploaded_by WHERE d.organization_id=$1 AND d.project_id=$2 ORDER BY d.updated_at DESC LIMIT 200`,[org,projectId]),
      db.query(`SELECT v.id,v.document_id,v.revision,v.mime_type,v.file_size_bytes,v.change_summary,v.created_at,u.display_name AS uploader FROM pm_document_versions v JOIN pm_documents d ON d.id=v.document_id AND d.organization_id=v.organization_id JOIN users u ON u.id=v.uploaded_by WHERE v.organization_id=$1 AND d.project_id=$2 ORDER BY v.created_at DESC LIMIT 500`,[org,projectId]),
      db.query(`SELECT m.id AS membership_id,u.display_name,u.email FROM pm_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.status='active' ORDER BY u.display_name LIMIT 500`,[org]),
      db.query(`SELECT id,task_code,title,status,planned_start_date,planned_end_date FROM pm_tasks WHERE organization_id=$1 AND project_id=$2 ORDER BY title LIMIT 1000`,[org,projectId]),
    ]);
    const canSubmit=Boolean(access.can_manage || ['project_admin','editor','contributor'].includes(access.project_access||''));
    return NextResponse.json({canManage:access.can_manage,canSubmit,currentMembershipId:access.actor_membership_id,suppliers:suppliers.rows,indents:indents.rows,purchaseOrders:orders.rows,goodsReceipts:receipts.rows,goodsReceiptItems:receiptItems.rows,purchaseOrderItems:purchaseOrderItems.rows,resources:resources.rows,allocations:allocations.rows,workforceAssignments:assignments.rows,timesheets:timesheets.rows,inspections:inspections.rows,nonconformities:ncs.rows,budgets:budgets.rows,financialEntries:entries.rows,documents:documents.rows,documentVersions:documentVersions.rows,members:members.rows,tasks:tasks.rows});
  } catch(error) {
    console.error('Project operations load failed',error);
    return NextResponse.json({error:'Project operations could not be loaded.'},{status:503});
  }
}

export async function POST(request: Request, context: {params: Promise<{projectId:string}>}) {
  const session=await auth();
  if(!session?.user?.id) return NextResponse.json({error:'Sign in to create an operational record.'},{status:401});
  const {projectId}=await context.params;
  if(!uuid.safeParse(projectId).success) return NextResponse.json({error:'Invalid project.'},{status:400});
  const input=await request.json().catch(()=>null);
  const parsed=base.safeParse(input);
  if(!parsed.success) return NextResponse.json({error:'Choose a valid operational module.'},{status:400});
  const access=await projectAccess(projectId,session.user.id);
  const canSubmit=Boolean(access && (access.can_manage || ['project_admin','editor','contributor'].includes(access.project_access||'')));
  if(!access || !canSubmit) return NextResponse.json({error:'You do not have permission to submit operational records in this project.'},{status:403});
  const org=access.organization_id;
  const client=await db.connect();
  try {
    await client.query('BEGIN');
    let created:any;
    const module=input.module;
    if(!access.can_manage){
      const allowed=(module==='procurement'&&input.action==='indent')||(module==='manpower'&&input.action==='timesheet')||(module==='quality'&&(input.action==='inspection'||input.action==='nonconformity'));
      if(!allowed)throw new Error('This operational action requires project-manager permission.');
    }
    if(module==='procurement') {
      const action=input.action;
      if(action==='supplier') {
        const p=z.object({legalName:text(240),supplierCode:z.string().trim().max(40).optional(),contactName:z.string().trim().max(160).optional(),email:z.string().email().optional().or(z.literal('')),phone:z.string().trim().max(40).optional(),taxRegistrationNumber:z.string().trim().max(80).optional()}).safeParse(input);
        if(!p.success) throw new Error(p.error.issues[0]?.message||'Check supplier details.');
        created=(await client.query(`INSERT INTO pm_suppliers(organization_id,supplier_code,legal_name,contact_name,email,phone,tax_registration_number) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,legal_name,status`,[org,p.data.supplierCode||null,p.data.legalName,p.data.contactName||null,p.data.email||null,p.data.phone||null,p.data.taxRegistrationNumber||null])).rows[0];
      } else if(action==='indent') {
        const p=z.object({purpose:text(2000),requiredBy:z.string().date().optional().nullable(),items:z.array(z.object({description:text(240),specification:z.string().max(1000).optional(),unit:text(40),quantity:amount,estimatedRate:amount.optional() })).min(1).max(100)}).safeParse(input);
        if(!p.success) throw new Error(p.error.issues[0]?.message||'Check material request.');
        const number=(await client.query(`SELECT 'MR-'||lpad((COALESCE(MAX(NULLIF(regexp_replace(indent_number,'[^0-9]','','g'), '')::bigint),0)+1)::text,5,'0') AS n FROM pm_material_indents WHERE organization_id=$1`,[org])).rows[0].n;
        const head=(await client.query(`INSERT INTO pm_material_indents(organization_id,project_id,indent_number,requested_by,required_by,purpose,status) VALUES($1,$2,$3,$4,$5,$6,'draft') RETURNING id,indent_number,status`,[org,projectId,number,session.user.id,p.data.requiredBy||null,p.data.purpose])).rows[0];
        for(const item of p.data.items) await client.query(`INSERT INTO pm_material_indent_items(organization_id,indent_id,description,specification,unit,target_quantity,estimated_rate) VALUES($1,$2,$3,$4,$5,$6,$7)`,[org,head.id,item.description,item.specification||'',item.unit,item.quantity,item.estimatedRate??null]);
        created=head;
      } else if(action==='purchase_order') {
        const p=z.object({supplierId:uuid,issueDate:z.string().date(),expectedDeliveryDate:z.string().date().optional().nullable(),currencyCode:z.string().length(3).default('INR'),items:z.array(z.object({description:text(240),specification:z.string().max(1000).optional(),unit:text(40),quantity:amount,unitRate:amount,taxRate:z.number().min(0).max(100).default(0)})).min(1).max(100)}).safeParse(input);
        if(!p.success) throw new Error(p.error.issues[0]?.message||'Check purchase order.');
        const supplier=await client.query('SELECT id FROM pm_suppliers WHERE id=$1 AND organization_id=$2 AND status=\'active\'', [p.data.supplierId,org]);
        if(!supplier.rows[0]) throw new Error('Select an active supplier from this organization.');
        const subtotal=p.data.items.reduce((s,i)=>s+i.quantity*i.unitRate,0);
        const tax=p.data.items.reduce((s,i)=>s+i.quantity*i.unitRate*i.taxRate/100,0);
        const poNumber=(await client.query(`SELECT 'PO-'||lpad((COALESCE(MAX(NULLIF(regexp_replace(po_number,'[^0-9]','','g'), '')::bigint),0)+1)::text,5,'0') AS n FROM pm_purchase_orders WHERE organization_id=$1`,[org])).rows[0].n;
        const po=(await client.query(`INSERT INTO pm_purchase_orders(organization_id,project_id,supplier_id,po_number,issue_date,expected_delivery_date,currency_code,subtotal,tax_total,total_amount,status,terms,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft','{}'::jsonb,$11) RETURNING id,po_number,total_amount,status`,[org,projectId,p.data.supplierId,poNumber,p.data.issueDate,p.data.expectedDeliveryDate||null,p.data.currencyCode.toUpperCase(),subtotal,tax,subtotal+tax,session.user.id])).rows[0];
        for(let i=0;i<p.data.items.length;i++){const item=p.data.items[i];const line=item.quantity*item.unitRate;await client.query(`INSERT INTO pm_purchase_order_items(organization_id,purchase_order_id,line_number,description,specification,unit,ordered_quantity,unit_rate,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[org,po.id,i+1,item.description,item.specification||'',item.unit,item.quantity,item.unitRate,item.taxRate,line*(1+item.taxRate/100)]);}
        created=po;
      } else if(action==='goods_receipt') {
        const p=z.object({purchaseOrderId:uuid,receivedAt:z.string().datetime().optional().nullable(),notes:z.string().max(2000).optional(),items:z.array(z.object({purchaseOrderItemId:uuid,receivedQuantity:amount,acceptedQuantity:amount.default(0),rejectedQuantity:amount.default(0),remarks:z.string().max(1000).optional()}).refine(x=>x.acceptedQuantity+x.rejectedQuantity<=x.receivedQuantity,{message:'Accepted plus rejected quantity cannot exceed received quantity.'})).min(1).max(100)}).safeParse(input);
        if(!p.success)throw new Error(p.error.issues[0]?.message||'Check goods receipt quantities.');
        const po=await client.query(`SELECT id FROM pm_purchase_orders WHERE id=$1 AND organization_id=$2 AND project_id=$3 AND status NOT IN ('draft','cancelled','closed') FOR UPDATE`,[p.data.purchaseOrderId,org,projectId]);
        if(!po.rows[0])throw new Error('Select an issued purchase order from this project.');
        const itemIds=p.data.items.map(x=>x.purchaseOrderItemId);
        if(new Set(itemIds).size!==itemIds.length)throw new Error('Each purchase-order line can appear only once in a receipt.');
        const receiptLines=await client.query(`SELECT id,ordered_quantity FROM pm_purchase_order_items WHERE organization_id=$1 AND purchase_order_id=$2 AND id=ANY($3::uuid[]) FOR UPDATE`,[org,p.data.purchaseOrderId,itemIds]);
        if(receiptLines.rows.length!==itemIds.length)throw new Error('One or more receipt lines do not belong to this purchase order.');
        for(const item of p.data.items){
          if(item.receivedQuantity<=0)throw new Error('Received quantity must be greater than zero.');
          const already=await client.query(`SELECT COALESCE(SUM(gi.received_quantity),0)::numeric AS quantity FROM pm_goods_receipt_items gi JOIN pm_goods_receipts gr ON gr.id=gi.receipt_id AND gr.organization_id=gi.organization_id WHERE gi.organization_id=$1 AND gi.purchase_order_item_id=$2 AND gr.status<>'rejected'`,[org,item.purchaseOrderItemId]);
          const ordered=receiptLines.rows.find(x=>x.id===item.purchaseOrderItemId);
          if(Number(already.rows[0].quantity)+item.receivedQuantity>Number(ordered.ordered_quantity)+0.0001)throw new Error('Received quantity exceeds the outstanding purchase-order quantity.');
        }
        const number=(await client.query(`SELECT 'GRN-'||lpad((COALESCE(MAX(NULLIF(regexp_replace(receipt_number,'[^0-9]','','g'), '')::bigint),0)+1)::text,5,'0') AS n FROM pm_goods_receipts WHERE organization_id=$1`,[org])).rows[0].n;
        const receipt=(await client.query(`INSERT INTO pm_goods_receipts(organization_id,purchase_order_id,receipt_number,received_at,received_by,status,notes) VALUES($1,$2,$3,COALESCE($4::timestamptz,now()),$5,'draft',$6) RETURNING id,receipt_number,status`,[org,p.data.purchaseOrderId,number,p.data.receivedAt||null,session.user.id,p.data.notes||''])).rows[0];
        for(const item of p.data.items) await client.query(`INSERT INTO pm_goods_receipt_items(organization_id,receipt_id,purchase_order_item_id,received_quantity,accepted_quantity,rejected_quantity,remarks) VALUES($1,$2,$3,$4,$5,$6,$7)`,[org,receipt.id,item.purchaseOrderItemId,item.receivedQuantity,item.acceptedQuantity,item.rejectedQuantity,item.remarks||'']);
        created=receipt;
      } else throw new Error('Unsupported procurement action.');
    } else if(module==='manpower') {
      const action=input.action;
      if(action==='resource') {
        const p=z.object({name:text(180),resourceClass:z.enum(['labour','equipment','vehicle','other']).default('labour'),unit:z.string().max(40).optional(),capacity:amount.optional(),costRate:amount.optional(),currencyCode:z.string().length(3).default('INR')}).safeParse(input);
        if(!p.success) throw new Error(p.error.issues[0]?.message||'Check resource details.');
        created=(await client.query(`INSERT INTO pm_resources(organization_id,name,resource_class,unit,capacity,cost_rate,currency_code) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,resource_class,status`,[org,p.data.name,p.data.resourceClass,p.data.unit||null,p.data.capacity??null,p.data.costRate??null,p.data.currencyCode.toUpperCase()])).rows[0];
      } else if(action==='assignment') {
        const p=z.object({membershipId:uuid,roleOnProject:text(120),plannedStart:z.string().date().optional().nullable(),plannedFinish:z.string().date().optional().nullable(),plannedHours:amount.optional(),notes:z.string().max(2000).optional()}).refine(v=>!v.plannedStart||!v.plannedFinish||v.plannedFinish>=v.plannedStart).safeParse(input);
        if(!p.success) throw new Error(p.error.issues[0]?.message||'Check workforce assignment.');
        const m=await client.query(`SELECT id FROM pm_memberships WHERE id=$1 AND organization_id=$2 AND status='active'`,[p.data.membershipId,org]);if(!m.rows[0])throw new Error('Select an active organization member.');
        created=(await client.query(`INSERT INTO pm_workforce_assignments(organization_id,project_id,membership_id,role_on_project,planned_start,planned_finish,planned_hours,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,role_on_project,status`,[org,projectId,p.data.membershipId,p.data.roleOnProject,p.data.plannedStart||null,p.data.plannedFinish||null,p.data.plannedHours??null,p.data.notes||''])).rows[0];
      } else if(action==='allocation') {
        const p=z.object({resourceId:uuid,startAt:z.string().datetime().optional().nullable(),finishAt:z.string().datetime().optional().nullable(),plannedQuantity:amount.optional(),notes:z.string().max(2000).optional()}).safeParse(input);
        if(!p.success)throw new Error(p.error.issues[0]?.message||'Check resource allocation.');
        created=(await client.query(`INSERT INTO pm_resource_allocations(organization_id,project_id,resource_id,start_at,finish_at,planned_quantity,notes) SELECT $1,$2,r.id,$4,$5,$6,$7 FROM pm_resources r WHERE r.id=$3 AND r.organization_id=$1 AND r.status='available' RETURNING id,status`,[org,projectId,p.data.resourceId,p.data.startAt||null,p.data.finishAt||null,p.data.plannedQuantity??null,p.data.notes||''])).rows[0];
        if(!created)throw new Error('Resource is not available in this organization.');
      } else if(action==='timesheet') {
        const p=z.object({membershipId:uuid,periodStart:z.string().date(),periodEnd:z.string().date(),entries:z.array(z.object({workDate:z.string().date(),hours:z.number().positive().max(24),taskId:uuid.optional().nullable(),description:z.string().max(2000).default('')})).min(1).max(100)}).refine(v=>v.periodEnd>=v.periodStart).safeParse(input);
        if(!p.success)throw new Error(p.error.issues[0]?.message||'Check timesheet dates and entries.');
        const m=await client.query(`SELECT id FROM pm_memberships WHERE id=$1 AND organization_id=$2 AND status='active'`,[p.data.membershipId,org]);if(!m.rows[0])throw new Error('Select an active organization member.');
        const sheet=(await client.query(`INSERT INTO pm_timesheets(organization_id,membership_id,period_start,period_end,status) VALUES($1,$2,$3,$4,'draft') RETURNING id,status`,[org,p.data.membershipId,p.data.periodStart,p.data.periodEnd])).rows[0];
        for(const e of p.data.entries){if(e.workDate<p.data.periodStart||e.workDate>p.data.periodEnd)throw new Error('Every timesheet entry date must be within the selected period.');if(e.taskId){const t=await client.query('SELECT id FROM pm_tasks WHERE id=$1 AND organization_id=$2 AND project_id=$3',[e.taskId,org,projectId]);if(!t.rows[0])throw new Error('Timesheet task must belong to this project.');}await client.query(`INSERT INTO pm_timesheet_entries(organization_id,timesheet_id,project_id,task_id,work_date,hours,work_description) VALUES($1,$2,$3,$4,$5,$6,$7)`,[org,sheet.id,projectId,e.taskId||null,e.workDate,e.hours,e.description]);}
        created=sheet;
      } else throw new Error('Unsupported manpower action.');
    } else if(module==='quality') {
      if(input.action==='inspection') {
        const p=z.object({inspectionType:text(120),inspectedAt:z.string().datetime().optional().nullable(),inspectorMembershipId:uuid.optional().nullable(),result:z.enum(['pending','pass','fail','conditional','rework']).default('pending'),findings:z.array(z.object({item:text(240),result:z.string().max(100),remarks:z.string().max(1000).optional()})).default([]),correctiveAction:z.string().max(4000).optional(),dueDate:z.string().date().optional().nullable()}).safeParse(input);
        if(!p.success)throw new Error(p.error.issues[0]?.message||'Check inspection details.');
        if(!access.can_manage && p.data.inspectorMembershipId && p.data.inspectorMembershipId!==access.actor_membership_id)throw new Error('You can record inspections only under your own membership.');
        const number=(await client.query(`SELECT 'INSP-'||lpad((COALESCE(MAX(NULLIF(regexp_replace(inspection_number,'[^0-9]','','g'), '')::bigint),0)+1)::text,5,'0') AS n FROM pm_quality_inspections WHERE organization_id=$1`,[org])).rows[0].n;
        created=(await client.query(`INSERT INTO pm_quality_inspections(organization_id,project_id,inspection_number,inspection_type,inspected_at,inspector_membership_id,result,findings,corrective_action,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING id,inspection_number,result`,[org,projectId,number,p.data.inspectionType,p.data.inspectedAt||null,p.data.inspectorMembershipId||null,p.data.result,JSON.stringify(p.data.findings),p.data.correctiveAction||'',p.data.dueDate||null])).rows[0];
      } else if(input.action==='nonconformity') {
        const p=z.object({title:text(240),description:z.string().max(5000).default(''),severity:z.enum(['minor','major','critical']),assignedToMembershipId:uuid.optional().nullable(),dueDate:z.string().date().optional().nullable(),inspectionId:uuid.optional().nullable()}).safeParse(input);
        if(!p.success)throw new Error(p.error.issues[0]?.message||'Check non-conformity details.');
        if(!access.can_manage && p.data.assignedToMembershipId && p.data.assignedToMembershipId!==access.actor_membership_id)throw new Error('You can assign a corrective action only to yourself.');
        const number=(await client.query(`SELECT 'NC-'||lpad((COALESCE(MAX(NULLIF(regexp_replace(nc_number,'[^0-9]','','g'), '')::bigint),0)+1)::text,5,'0') AS n FROM pm_quality_nonconformities WHERE organization_id=$1`,[org])).rows[0].n;
        created=(await client.query(`INSERT INTO pm_quality_nonconformities(organization_id,project_id,inspection_id,nc_number,title,description,severity,raised_by,assigned_to_membership_id,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,nc_number,status`,[org,projectId,p.data.inspectionId||null,number,p.data.title,p.data.description,p.data.severity,session.user.id,p.data.assignedToMembershipId||null,p.data.dueDate||null])).rows[0];
      } else throw new Error('Unsupported quality action.');
    } else if(module==='finance') {
      if(input.action==='budget') {
        const p=z.object({budgetName:text(180),currencyCode:z.string().length(3).default('INR'),baselineAmount:amount,revisedAmount:amount.optional()}).safeParse(input);
        if(!p.success)throw new Error(p.error.issues[0]?.message||'Check budget details.');
        created=(await client.query(`INSERT INTO pm_project_budgets(organization_id,project_id,budget_name,currency_code,baseline_amount,revised_amount,status) VALUES($1,$2,$3,$4,$5,$6,'draft') RETURNING id,budget_name,baseline_amount,revised_amount,status`,[org,projectId,p.data.budgetName,p.data.currencyCode.toUpperCase(),p.data.baselineAmount,p.data.revisedAmount??p.data.baselineAmount])).rows[0];
      } else if(input.action==='entry') {
        const p=z.object({entryType:z.enum(['budget','commitment','income','expense','receipt','payment','journal']),entryDate:z.string().date(),description:text(2000),accountCode:z.string().max(80).optional(),currencyCode:z.string().length(3).default('INR'),amount,taxAmount:amount.optional()}).safeParse(input);
        if(!p.success)throw new Error(p.error.issues[0]?.message||'Check financial entry.');
        const number=(await client.query(`SELECT 'FIN-'||lpad((COALESCE(MAX(NULLIF(regexp_replace(entry_number,'[^0-9]','','g'), '')::bigint),0)+1)::text,5,'0') AS n FROM pm_financial_entries WHERE organization_id=$1`,[org])).rows[0].n;
        created=(await client.query(`INSERT INTO pm_financial_entries(organization_id,project_id,entry_number,entry_type,entry_date,description,account_code,currency_code,amount,tax_amount,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11) RETURNING id,entry_number,entry_type,amount,status`,[org,projectId,number,p.data.entryType,p.data.entryDate,p.data.description,p.data.accountCode||null,p.data.currencyCode.toUpperCase(),p.data.amount,p.data.taxAmount??0,session.user.id])).rows[0];
      } else throw new Error('Unsupported finance action.');
    } else if(module==='documents') {
      const p=z.object({title:text(240),documentType:text(80),documentNumber:z.string().max(80).optional(),revision:z.string().max(40).default('A'),storageKey:text(1000),mimeType:z.string().max(160).optional(),fileSizeBytes:z.number().int().nonnegative().optional(),changeSummary:z.string().max(2000).optional()}).safeParse(input);
      if(!p.success)throw new Error(p.error.issues[0]?.message||'Check document details.');
      const doc=(await client.query(`INSERT INTO pm_documents(organization_id,project_id,document_number,title,document_type,revision,storage_key,mime_type,file_size_bytes,status,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10) RETURNING id,title,document_type,revision,status`,[org,projectId,p.data.documentNumber||null,p.data.title,p.data.documentType,p.data.revision,p.data.storageKey,p.data.mimeType||null,p.data.fileSizeBytes??null,session.user.id])).rows[0];
      await client.query(`INSERT INTO pm_document_versions(organization_id,document_id,revision,storage_key,mime_type,file_size_bytes,change_summary,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[org,doc.id,p.data.revision,p.data.storageKey,p.data.mimeType||null,p.data.fileSizeBytes??null,p.data.changeSummary||'Initial version',session.user.id]);
      created=doc;
    }
    await client.query(`INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[org,session.user.id,projectId,'operations.'+module+'.created',module,created.id,JSON.stringify(created)]);
    await client.query('COMMIT');
    return NextResponse.json({record:created},{status:201});
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>undefined);
    const message=error instanceof Error?error.message:'Could not save the operational record.';
    console.error('Project operational record creation failed',error);
    return NextResponse.json({error:message},{status:400});
  } finally {client.release();}
}

export async function PATCH(request: Request, context: {params: Promise<{projectId:string}>}) {
  const session=await auth();
  if(!session?.user?.id)return NextResponse.json({error:'Sign in to update project operations.'},{status:401});
  const {projectId}=await context.params;
  if(!uuid.safeParse(projectId).success)return NextResponse.json({error:'Invalid project.'},{status:400});
  const input=await request.json().catch(()=>null);
  const p=z.object({module:z.enum(['procurement','manpower','quality','finance','documents']),id:uuid,status:text(40),decision:z.enum(['approve','reject']).optional()}).safeParse(input);
  if(!p.success)return NextResponse.json({error:p.error.issues[0]?.message||'Check the update.'},{status:400});
  const access=await projectAccess(projectId,session.user.id,true);
  if(!access || !access.can_manage)return NextResponse.json({error:'Only project managers and organization administrators can update approval/status fields.'},{status:403});
  const {module,id,status,decision}=p.data;const org=access.organization_id;
  const maps:any={
    procurement:{indent:['pm_material_indents','status','updated_at',['draft','submitted','approved','rejected','partially_ordered','ordered','closed','cancelled'],'project',true],purchase_order:['pm_purchase_orders','status','updated_at',['draft','submitted','approved','sent','partially_received','received','closed','cancelled'],'project',true],goods_receipt:['pm_goods_receipts','status',null,['draft','inspected','accepted','rejected','partially_accepted'],'purchase_order',false]},
    manpower:{assignment:['pm_workforce_assignments','status','updated_at',['planned','active','completed','released','cancelled'],'project',false],timesheet:['pm_timesheets','status','updated_at',['draft','submitted','approved','rejected','locked'],'timesheet',true]},
    quality:{inspection:['pm_quality_inspections','result',null,['pending','pass','fail','conditional','rework'],'project',false],nonconformity:['pm_quality_nonconformities','status','updated_at',['open','contained','under_review','corrective_action','verification','closed','rejected'],'project',false]},
    finance:{budget:['pm_project_budgets','status','updated_at',['draft','submitted','approved','locked'],'project',true],entry:['pm_financial_entries','status','updated_at',['draft','submitted','approved','posted','void'],'project',true]},
    documents:{document:['pm_documents','status','updated_at',['draft','in_review','approved','superseded','archived'],'project',true]}
  };
  const kind=String((input as any).kind||'');
  const config=maps[module]?.[kind];
  if(!config||!config[3].includes(status))return NextResponse.json({error:'Unsupported record type or status.'},{status:400});
  if(decision==='approve' && !access.can_manage)return NextResponse.json({error:'Approval requires project-manager permission.'},{status:403});
  const [table,statusColumn,updatedColumn,allowed,scopeType,hasApproval]=config;
  const scope=scopeType==='project'?' AND project_id=$3':scopeType==='timesheet'?' AND EXISTS (SELECT 1 FROM pm_timesheet_entries te WHERE te.timesheet_id='+table+'.id AND te.organization_id='+table+'.organization_id AND te.project_id=$3)':scopeType==='purchase_order'?' AND EXISTS (SELECT 1 FROM pm_purchase_orders pox WHERE pox.id=pm_goods_receipts.purchase_order_id AND pox.organization_id=pm_goods_receipts.organization_id AND pox.project_id=$3)':'';
  const values:any[]=[id,org];if(scope)values.push(projectId);
  const setUpdated=updatedColumn?`, ${updatedColumn}=now()`:'';
  const approval=decision==='approve'&&hasApproval?',approved_by=$'+(values.length+2)+',approved_at=now()':'';
  const client=await db.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(`UPDATE ${table} SET ${statusColumn}=$${values.length+1}${setUpdated} ${approval} WHERE id=$1 AND organization_id=$2 ${scope} RETURNING id,${statusColumn} AS status`,[...values,status]);
    if(!result.rows[0]){await client.query('ROLLBACK');return NextResponse.json({error:'Record not found in this project.'},{status:404});}
    if(module==='procurement' && kind==='goods_receipt' && ['accepted','partially_accepted','rejected'].includes(status)){
      const lines=await client.query(`SELECT gi.purchase_order_item_id,gi.received_quantity,gi.accepted_quantity,gi.rejected_quantity FROM pm_goods_receipt_items gi WHERE gi.organization_id=$1 AND gi.receipt_id=$2 FOR UPDATE`,[org,id]);
      if(!lines.rows.length)throw new Error('A goods receipt must contain at least one line.');
      for(const line of lines.rows){
        if(Number(line.accepted_quantity)+Number(line.rejected_quantity)!==Number(line.received_quantity))throw new Error('Before finalizing this receipt, accepted plus rejected quantities must equal the received quantity on every line.');
        if(status==='accepted' && Number(line.rejected_quantity)>0)throw new Error('Use Partially accepted or Rejected when any quantity is rejected.');
        if(status==='rejected' && Number(line.accepted_quantity)>0)throw new Error('Rejected receipts cannot contain accepted quantities.');
      }
      const poId=(await client.query('SELECT purchase_order_id FROM pm_goods_receipts WHERE id=$1 AND organization_id=$2',[id,org])).rows[0]?.purchase_order_id;
      await client.query(`UPDATE pm_purchase_order_items poi SET received_quantity=COALESCE((SELECT SUM(gi.accepted_quantity) FROM pm_goods_receipt_items gi JOIN pm_goods_receipts gr ON gr.id=gi.receipt_id AND gr.organization_id=gi.organization_id WHERE gi.organization_id=poi.organization_id AND gi.purchase_order_item_id=poi.id AND gr.status IN ('accepted','partially_accepted')),0) WHERE poi.organization_id=$1 AND poi.purchase_order_id=$2`,[org,poId]);
      await client.query(`UPDATE pm_purchase_orders po SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM pm_purchase_order_items poi WHERE poi.organization_id=po.organization_id AND poi.purchase_order_id=po.id AND poi.received_quantity<poi.ordered_quantity) THEN 'received' WHEN EXISTS(SELECT 1 FROM pm_purchase_order_items poi WHERE poi.organization_id=po.organization_id AND poi.purchase_order_id=po.id AND poi.received_quantity>0) THEN 'partially_received' ELSE po.status END,updated_at=now() WHERE po.organization_id=$1 AND po.id=$2`,[org,poId]);
    }
    await client.query(`INSERT INTO pm_audit_events(organization_id,actor_user_id,project_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[org,session.user.id,projectId,'operations.'+module+'.status_changed',kind,id,JSON.stringify({status,decision:decision||null})]);
    await client.query('COMMIT');
    return NextResponse.json({record:result.rows[0]});
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);console.error('Project operational status update failed',error);return NextResponse.json({error:'Could not update this record.'},{status:503});}
  finally{client.release();}
}
