'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

type Field = { key:string; label:string; type:'text'|'number'|'date'|'select'|'checkbox'|'formula'; required?:boolean; defaultValue?:string|number|boolean|null; options?:string[]; formula?:string };
type Draft = { product:{id:string;title:string;description:string;slug:string;status:string;moderation_status:string}; build:{id:string;version_number:number;build_kind:string;status:string;definition_json:{description?:string;fields?:Field[]}; validation_json?:{valid?:boolean;errors?:string[]}}; edition?:{market_code:string;locale:string;title:string;description:string} };
export default function CreatorDraftPreview(){
 const params=useParams<{productId:string}>(); const productId=params.productId;
 const [draft,setDraft]=useState<Draft|null>(null); const [values,setValues]=useState<Record<string,string|boolean|number>>({});
 const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
 const fields=useMemo(()=>draft?.build.definition_json.fields??[],[draft]);
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/creator/products/'+encodeURIComponent(productId)+'/publication',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load draft');setDraft(d);const next:Record<string,string|boolean|number>={};for(const f of d.build.definition_json.fields??[])next[f.key]=f.defaultValue===undefined||f.defaultValue===null?'':f.defaultValue as string|number|boolean;setValues(next)}catch(e){setError(e instanceof Error?e.message:'Could not load draft')}finally{setLoading(false)}}
 useEffect(()=>{if(productId)void load()},[productId]);
 async function submitForReview(){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/creator/products/'+encodeURIComponent(productId)+'/publication',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'submit'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not submit for review');setNotice(d.message||'Submitted for review');await load()}catch(e){setError(e instanceof Error?e.message:'Could not submit for review')}finally{setBusy(false)}}
 if(loading)return <main className="wrap"><p className="muted">Loading private draft preview…</p></main>;
 if(error&&!draft)return <main className="wrap"><Link href="/seller/studio">← Creator Studio</Link><p className="error" role="alert">{error}</p></main>;
 if(!draft)return null;
 const validationErrors=draft.build.validation_json?.errors??[];
 const canSubmit=draft.product.status==='draft'&&draft.build.status!=='published';
 return <main className="wrap catalog-page">
  <div className="page-head"><div><span className="eyebrow">PRIVATE CREATOR PREVIEW · VERSION {draft.build.version_number}</span><h1>{draft.product.title}</h1><p className="muted">Only you can see this draft preview. The fields below show the current layout; calculations are not available in this preview.</p></div><Link className="btn" href="/seller/studio">← Creator Studio</Link></div>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="badge" role="status">{notice}</p>}
  <div className="checkout-grid" style={{alignItems:'start'}}><section className="panel"><span className="category">{draft.build.build_kind.replaceAll('_',' ')}</span><h2>{draft.build.definition_json.description||draft.product.description||'Interactive product preview'}</h2><p className="muted">{draft.edition?.market_code??'Market not set'} · {draft.edition?.locale??'Locale not set'}</p>
  {fields.length===0?<p className="muted">No input fields have been added to this draft yet. Return to Creator Studio to add the first field.</p>:<form className="auth-form" onSubmit={e=>e.preventDefault()}>{fields.map((f)=><label key={f.key}>{f.label}{f.required&&' *'}{f.type==='checkbox'?<input type="checkbox" checked={Boolean(values[f.key])} onChange={e=>setValues(v=>({...v,[f.key]:e.target.checked}))}/>:f.type==='formula'?<><input value={f.formula||'Formula preview — calculations are not available yet'} readOnly/><small className="muted">This preview shows the formula text only; it does not calculate a result.</small></>:f.type==='select'?<select value={String(values[f.key]??'')} required={Boolean(f.required)} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}><option value="">Choose…</option>{(f.options??[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:<input type={f.type==='number'?'number':f.type==='date'?'date':'text'} value={String(values[f.key]??'')} required={Boolean(f.required)} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>}</label>)}</form>}
  </section><aside className="panel"><h2>Review &amp; publishing</h2><p><strong>Draft status:</strong> {draft.product.status.replaceAll('_',' ')}</p><p><strong>Build status:</strong> {draft.build.status.replaceAll('_',' ')}</p><p><strong>Review status:</strong> {draft.product.moderation_status.replaceAll('_',' ')}</p>{validationErrors.length>0&&<ul>{validationErrors.map((e,i)=><li key={i}>{e}</li>)}</ul>}<p className="muted">Submitting sends this draft for review. It will not be published immediately.</p><button className="btn primary wide" type="button" disabled={busy||!canSubmit||fields.length===0} onClick={()=>void submitForReview()}>{busy?'Submitting…':'Validate & submit for review'}</button><p className="muted" style={{fontSize:12}}>Your product can be published only after the required review is complete.</p></aside></div>
 </main>
}
