'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Product = { id:string; title:string; slug:string; status:string; moderation_status:string; version_number:number|null; build_kind:string|null; market_code:string|null };
export default function CreatorStudio() {
  const [items,setItems]=useState<Product[]>([]);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [kind,setKind]=useState('interactive_tool');
  const [market,setMarket]=useState('IN');
  const [currency,setCurrency]=useState('INR');
  const [price,setPrice]=useState('0');
  const [fieldKey,setFieldKey]=useState('amount');
  const [fieldLabel,setFieldLabel]=useState('Amount');
  const [fieldType,setFieldType]=useState('number');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  async function load(){setLoading(true);try{const r=await fetch('/api/creator/products',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load products');setItems(d.products||[]);setError('')}catch(e){setError(e instanceof Error?e.message:'Could not load products')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/creator/products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,description,buildKind:kind,market,currency,locale:market==='IN'?'en-IN':market==='UK'?'en-GB':'en-US',priceMinor:Math.round(Number(price||0)*100),definition:{schemaVersion:1,description,fields:[{key:fieldKey,label:fieldLabel,type:fieldType,required:false}]}})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save draft');setNotice(d.message||'Draft saved');setTitle('');setDescription('');await load()}catch(e){setError(e instanceof Error?e.message:'Could not save draft')}finally{setBusy(false)}}
  return <main className="wrap"><div className="page-head"><div><span className="eyebrow">CREATOR STUDIO</span><h1>Build inside DigiNanba</h1><p className="muted">Create and save structured product drafts on the marketplace. Every draft belongs to your creator account.</p></div><Link className="btn" href="/seller">Seller Center</Link></div>
  <div className="checkout-grid" style={{alignItems:'start'}}><section className="panel"><h2>Create product draft</h2><p className="muted">Start with an interactive tool, spreadsheet, template, ebook or course. Publication stays gated until validation and moderation are implemented.</p>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="badge" role="status">{notice}</p>}
  <form className="auth-form" onSubmit={submit}>
  <label>Product title<input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Monthly income and expense tracker"/></label>
  <label>Description<textarea rows={3} maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What problem does your product solve?"/></label>
  <label>Product type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="interactive_tool">Interactive tool</option><option value="spreadsheet">Spreadsheet</option><option value="template">Template</option><option value="ebook">Ebook / guide</option><option value="course">Course</option><option value="other">Other</option></select></label>
  <div className="checkout-grid"><label>Market<select value={market} onChange={e=>{setMarket(e.target.value);setCurrency(e.target.value==='IN'?'INR':e.target.value==='UK'?'GBP':'USD')}}><option value="IN">India</option><option value="US">United States</option><option value="UK">United Kingdom</option></select></label><label>Price ({currency})<input type="number" min="0" step=".01" value={price} onChange={e=>setPrice(e.target.value)}/><small className="muted">A saved price is not a live charge.</small></label></div>
  <h3>First tool field</h3><p className="muted">Fields are stored as structured data, not executable code.</p>
  <label>Field key<input required pattern="[a-zA-Z][a-zA-Z0-9_]{0,39}" value={fieldKey} onChange={e=>setFieldKey(e.target.value)}/></label>
  <label>Field label<input required maxLength={80} value={fieldLabel} onChange={e=>setFieldLabel(e.target.value)}/></label>
  <label>Field type<select value={fieldType} onChange={e=>setFieldType(e.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Select</option><option value="checkbox">Checkbox</option><option value="formula">Formula</option></select></label>
  <button className="btn primary wide" disabled={busy}>{busy?'Saving…':'Save draft'}</button></form></section>
  <aside className="panel"><h2>Your products</h2>{loading?<p className="muted">Loading…</p>:items.length===0?<p className="muted">No creator drafts yet.</p>:items.map(p=><article key={p.id} style={{padding:'14px 0',borderBottom:'1px solid #e7e8ee'}}><strong>{p.title}</strong><p className="muted">{p.build_kind||'Build'} · v{p.version_number||1} · {p.market_code||'No market'}</p><span className="badge">{p.status}</span> <span className="badge">{p.moderation_status}</span></article>)}<hr/><h3>Next</h3><ul><li>Preview and validate the tool.</li><li>Validate formulas and outputs.</li><li>Submit for review before publishing.</li><li>Connect checkout, delivery and payouts after provider setup.</li></ul><p className="muted">Real payments and creator settlements are not enabled by this studio.</p></aside></div></main>
}
