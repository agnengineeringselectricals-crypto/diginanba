import {auth} from '@/lib/auth';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {db} from '@/lib/db';

export default async function SellerCustomers(){
 const session=await auth();if(!session?.user)redirect('/login');
 let customers:{id:string;full_name:string|null;created_at:string;source:string;display_name:string}[]=[];
 try{
  const result=await db.query(
   `SELECT c.id,c.full_name,c.created_at,c.source,a.display_name
    FROM marketplace_customers c
    JOIN marketplace_customer_accounts a ON a.id=c.account_id AND a.owner_user_id=c.owner_user_id
    WHERE c.owner_user_id=$1 AND c.status <> 'archived'
    ORDER BY c.created_at DESC LIMIT 500`,
   [session.user.id]
  );
  customers=result.rows;
 }catch(error){console.error('Load CRM customers failed',error);}
 return <main className="wrap">
  <Link href="/seller" className="muted">← Seller Center</Link>
  <h1>Customers</h1>
  <p className="muted">Customers connected to your DigiNanba workspaces, including people who accepted your invitations.</p>
  <div className="panel">
   <h2>Customer workspace</h2>
   {customers.length ? <div style={{display:'grid',gap:0}}>
    {customers.map(customer=><div key={customer.id} style={{padding:'14px 0',borderBottom:'1px solid #eaecf0',display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
     <div><strong>{customer.full_name||'DigiNanba customer'}</strong><div className="muted" style={{fontSize:13}}>{customer.display_name} · {customer.source==='referral'?'Invitation accepted':customer.source}</div></div>
     <span className="muted" style={{fontSize:12}}>{new Date(customer.created_at).toLocaleDateString()}</span>
    </div>)}
   </div> : <p className="muted">No connected customers yet. Share your shop invitation link from My Shop Dashboard. Customers appear here after they accept.</p>}
  </div>
 </main>;
}
