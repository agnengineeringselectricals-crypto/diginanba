'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect,useState,type CSSProperties,type FormEvent } from 'react';
import ShopFulfilmentSettings from '@/app/components/ShopFulfilmentSettings';

type Shop={id:string;public_id:string;business_name:string;country_code:string;phone:string|null;email:string|null;city:string|null;region:string|null;verification_status:string;door_delivery_enabled:boolean;self_collection_enabled:boolean;listings:{id:string;title:string;category:string;priceAmount:number|null;currency:string|null;priceUnit:string|null;availability:string}[]};
const field:CSSProperties={width:'100%',boxSizing:'border-box',padding:'11px 12px',border:'1px solid #d0d5dd',borderRadius:10,font:'inherit',background:'#fff'};
const button:CSSProperties={border:0,borderRadius:999,padding:'11px 16px',background:'#176b4d',color:'#fff',fontWeight:750,cursor:'pointer'};

export default function MyShopsManager(){
 const [shops,setShops]=useState<Shop[]>([]);
 const [selected,setSelected]=useState('');
 const [phone,setPhone]=useState('');
 const [email,setEmail]=useState('');
 const [product,setProduct]=useState('');
 const [category,setCategory]=useState('Groceries & Daily Needs');
 const [price,setPrice]=useState('');
 const [unit,setUnit]=useState('piece');
 const [message,setMessage]=useState('');
 const [invitationLink,setInvitationLink]=useState('');
 const [busy,setBusy]=useState(false);
 async function load(){
  const r=await fetch('/api/marketplace/shops/mine');const d=await r.json();
  if(!r.ok)throw new Error(d.error||'Could not load shops.');
  setShops(d.shops||[]);
  if(d.shops?.length){setSelected((old:string)=>old||d.shops[0].id);setPhone(d.shops[0].phone||'');setEmail(d.shops[0].email||'');}
 }
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
 const current=shops.find(s=>s.id===selected);
 const currency=current?.country_code==='IN'?'INR':current?.country_code==='GB'?'GBP':current?.country_code==='AU'?'AUD':current?.country_code==='CA'?'CAD':'USD';
 function choose(id:string){const s=shops.find(x=>x.id===id);setSelected(id);setPhone(s?.phone||'');setEmail(s?.email||'');}
 async function createCustomerInvite(){
  if(!current)return;setBusy(true);setMessage('');setInvitationLink('');
  try{
   const r=await fetch('/api/marketplace/invitations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({direction:'owner_to_customer',businessId:current.id,channel:'link'})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create invitation.');
   const fullUrl=window.location.origin+d.invitationPath;setInvitationLink(fullUrl);setMessage('Invitation link created. Share it with your customer.');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not create invitation.');}finally{setBusy(false);}
 }
 async function saveContact(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!current)return;setBusy(true);setMessage('');try{const r=await fetch('/api/marketplace/shops/mine',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({businessId:current.id,phone,email})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save.');setMessage(d.message);await load();}catch(e){setMessage(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}
 async function addProduct(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!current)return;setBusy(true);setMessage('');try{const r=await fetch('/api/marketplace/shops',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({businessId:current.id,title:product,description:'',category,listingType:'physical_product',priceAmount:price?Number(price):undefined,currency:price?currency:undefined,priceUnit:unit})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not add product.');setProduct('');setPrice('');setMessage(d.message);await load();}catch(e){setMessage(e instanceof Error?e.message:'Could not add product.');}finally{setBusy(false);}}
 if(!shops.length)return <main style={{maxWidth:850,margin:'0 auto',padding:32}}><h1>My Shop Owner Dashboard</h1><p>You have not registered a shop yet.</p><a href="/join/shop" style={{color:'#2454c6'}}>Register your shop →</a>{message?<p>{message}</p>:null}</main>;
 return <main style={{maxWidth:1100,margin:'0 auto',padding:'0 18px 70px',color:'#172033'}}>
  <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',padding:'16px 0',borderBottom:'1px solid #eaecf0',marginBottom:24}}>
   <Link href="/" style={{display:'flex',alignItems:'center',gap:9,textDecoration:'none',color:'#172033',fontSize:23,fontWeight:850,letterSpacing:-.5}}><span style={{display:'grid',placeItems:'center',width:36,height:36,borderRadius:11,background:'#176b4d',color:'#fff',fontSize:19}}>D</span><span>DigiNanba</span></Link>
   <nav aria-label="Main navigation" style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',fontSize:14,fontWeight:650}}>
    <Link href="/explore" style={{color:'#344054',textDecoration:'none'}}>Explore</Link>
    <Link href="/account" style={{color:'#344054',textDecoration:'none'}}>My Account</Link>
    <Link href="/account/messages" style={{color:'#344054',textDecoration:'none'}}>Messages</Link>
    <button type="button" onClick={()=>signOut({callbackUrl:'/'})} style={{border:'1px solid #d0d5dd',borderRadius:999,padding:'8px 14px',background:'#fff',color:'#344054',fontWeight:700,cursor:'pointer'}}>Sign out</button>
   </nav>
  </header>
  <h1 style={{fontSize:32,margin:'0 0 8px'}}>My Shop Dashboard</h1><p style={{color:'#667085',marginTop:0}}>Manage your shop details and product catalogue.</p>
  <label style={{display:'grid',gap:6,fontWeight:650}}>Choose shop<select value={selected} onChange={e=>choose(e.target.value)} style={field}>{shops.map(s=><option key={s.id} value={s.id}>{s.business_name} · {s.public_id}</option>)}</select></label>
  {current?<><section style={{marginTop:18,padding:18,border:'1px solid #e4e7ec',borderRadius:16}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 5px'}}>{current.business_name}</h2><strong style={{fontSize:20,color:'#176b4d',letterSpacing:1.3}}>{current.public_id}</strong><div style={{fontSize:12,color:'#667085',marginTop:6}}>{current.verification_status==='verified'?'Verified':'New on DigiNanba · Not yet verified'}</div></div><div style={{fontSize:13,color:'#667085'}}>{current.listings.length} products listed</div></div>
  </section>
  <section style={{marginTop:16,padding:18,border:'1px solid #e4e7ec',borderRadius:16,display:'grid',gap:10}}>
   <h2 style={{margin:0,fontSize:20}}>Invite Customers</h2>
   <p style={{margin:0,color:'#667085',fontSize:13}}>Invite customers to join DigiNanba and connect with this shop. Once they accept, your CRM customer list will show them. Marketing messages still require separate customer consent.</p>
   <button type="button" disabled={busy} onClick={createCustomerInvite} style={button}>{busy?'Creating…':'Create customer invitation link'}</button>
   {invitationLink?<><div style={{padding:10,background:'#f8fafc',borderRadius:8,overflowWrap:'anywhere',fontSize:13}}>{invitationLink}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>navigator.clipboard.writeText(invitationLink)} style={button}>Copy link</button><a href={'https://wa.me/?text='+encodeURIComponent('You are invited to connect with '+current.business_name+' on DigiNanba: '+invitationLink)} target="_blank" rel="noreferrer" style={{...button,textDecoration:'none'}}>Share on WhatsApp</a><a href={'sms:?body='+encodeURIComponent('You are invited to connect with '+current.business_name+' on DigiNanba: '+invitationLink)} style={{...button,textDecoration:'none'}}>Share by SMS</a></div></>:null}
  </section>
  <ShopFulfilmentSettings businessId={current.id} initialDelivery={current.door_delivery_enabled} initialPickup={current.self_collection_enabled}/>
  <form onSubmit={saveContact} style={{marginTop:16,padding:18,border:'1px solid #e4e7ec',borderRadius:16,display:'grid',gap:12}}>
   <h2 style={{margin:0,fontSize:20}}>Shop Owner Profile Settings</h2><p style={{margin:0,color:'#667085',fontSize:13}}>Phone and email are optional. You can add or update them whenever you wish.</p>
   <label style={{display:'grid',gap:5,fontSize:14}}>Phone number<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} style={field}/></label>
   <label style={{display:'grid',gap:5,fontSize:14}}>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
   <button disabled={busy} style={button}>Save contact settings</button>
  </form>
  <form onSubmit={addProduct} style={{marginTop:16,padding:18,border:'1px solid #e4e7ec',borderRadius:16,display:'grid',gap:12}}>
   <h2 style={{margin:0,fontSize:20}}>Add a Product</h2>
   <label style={{display:'grid',gap:5,fontSize:14}}>Product name<input required minLength={3} value={product} onChange={e=>setProduct(e.target.value)} placeholder="Enter product name" style={field}/></label>
   <label style={{display:'grid',gap:5,fontSize:14}}>Category<select value={category} onChange={e=>setCategory(e.target.value)} style={field}>{['Groceries & Daily Needs','Vegetables & Fruits','Medical Shops & Pharmacy','Food, Bakery & Sweets','Clothing & Footwear','Mobile & Electronics','Electrical & Hardware','Home & Kitchen','Building Materials','Vehicle Spares','Stationery & Books','Beauty & Personal Care','Agriculture & Garden','Pet Supplies','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={{display:'grid',gap:5,fontSize:14}}>Price ({currency})<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} style={field}/></label><label style={{display:'grid',gap:5,fontSize:14}}>Unit<select value={unit} onChange={e=>setUnit(e.target.value)} style={field}>{['piece','kg','g','litre','ml','packet','box','dozen','pack'].map(x=><option key={x}>{x}</option>)}</select></label></div>
   <button disabled={busy} style={button}>Add product to shop</button>
  </form>
  <section style={{marginTop:18}}><h2 style={{fontSize:20}}>Your Products</h2>{current.listings.map(p=><div key={p.id} style={{padding:'12px 0',borderBottom:'1px solid #eaecf0'}}><strong>{p.title}</strong><div style={{fontSize:12,color:'#667085'}}>{p.category}{p.priceAmount!=null?' · '+(p.currency||'')+' '+p.priceAmount+(p.priceUnit?' / '+p.priceUnit:'') : ''}</div></div>)}</section>
  </>:null}
  {message?<p role="status" style={{color:'#475467'}}>{message}</p>:null}
 </main>;
}
