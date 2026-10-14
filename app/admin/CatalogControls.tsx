'use client';

import { useCallback, useEffect, useState } from 'react';

type Product = { id: string; slug: string; title: string; description: string | null; product_type: string; status: string; created_at?: string; category_name?: string | null };
const types = ['template','spreadsheet','ebook','guide','course','asset','tool'];

export default function CatalogControls() {
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState({ title: '', description: '', productType: 'template' });
  const [priceProductId, setPriceProductId] = useState('');
  const [priceMarket, setPriceMarket] = useState('US');
  const [priceAmount, setPriceAmount] = useState('19.99');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/catalog', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load catalog');
      const loaded = Array.isArray(payload.products) ? payload.products as Product[] : [];
      setProducts(loaded);
      setPriceProductId(current => current || loaded[0]?.id || '');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load catalog'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to create product');
      setDraft({ title: '', description: '', productType: 'template' });
      setMessage('Product created as a draft. Review the details before publishing.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create product'); }
    finally { setBusy(false); }
  }

  async function savePrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const amount = Number(priceAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) { setError('Enter a valid positive price.'); setBusy(false); return; }
    try {
      const response = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'price', productId: priceProductId, marketCode: priceMarket, amountMinor: Math.round(amount * 100) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save market price');
      setMessage(`Saved ${payload.currency} ${(payload.amountMinor / 100).toFixed(2)} for ${payload.market}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save market price'); }
    finally { setBusy(false); }
  }

  async function save(product: Product) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/catalog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: product.id, title: product.title, description: product.description || '', productType: product.product_type, status: product.status }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save product');
      setMessage(`Saved “${product.title}”.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save product'); }
    finally { setBusy(false); }
  }

  const input: React.CSSProperties = { width: '100%', border: '1px solid #dfe3ed', borderRadius: 9, padding: '10px 11px', color: '#182033', background: '#fff', fontSize: 13, boxSizing: 'border-box' };
  const button: React.CSSProperties = { border: 0, borderRadius: 9, padding: '10px 13px', background: '#5143d8', color: '#fff', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .65 : 1 };
  return <div>
    <section style={{ background:'#fff', border:'1px solid #e7e9f1', borderRadius:18, padding:20, marginBottom:18 }}>
      <h2 style={{ margin:'0 0 6px', fontSize:18 }}>Create a digital product</h2>
      <p style={{ margin:'0 0 17px', color:'#778095', fontSize:13, lineHeight:1.6 }}>New products are saved as drafts. Publishing is an explicit admin action; a downloadable asset and price still need to be configured before a product is ready for sale.</p>
      <form onSubmit={create} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
        <label style={{ display:'grid', gap:6, fontSize:12, fontWeight:750 }}>Product title<input style={input} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} minLength={3} maxLength={180} required /></label>
        <label style={{ display:'grid', gap:6, fontSize:12, fontWeight:750 }}>Product type<select style={input} value={draft.productType} onChange={e=>setDraft({...draft,productType:e.target.value})}>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
        <label style={{ display:'grid', gap:6, fontSize:12, fontWeight:750, gridColumn:'1 / -1' }}>Description<textarea style={{...input,minHeight:84,resize:'vertical'}} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} maxLength={5000} placeholder="What problem does this product solve?" /></label>
        <div><button disabled={busy} type="submit" style={button}>{busy ? 'Saving…' : 'Create draft'}</button></div>
      </form>
      {message && <p role="status" style={{color:'#087f65',fontSize:13,marginBottom:0}}>{message}</p>}
      {error && <p role="alert" style={{color:'#a23a3a',fontSize:13}}>{error}</p>}
    </section>
    <section style={{ background:'#fff', border:'1px solid #e7e9f1', borderRadius:18, padding:20, marginBottom:18 }}>
      <h2 style={{ margin:'0 0 6px', fontSize:18 }}>Market edition & pricing</h2>
      <p style={{ margin:'0 0 16px', color:'#778095', fontSize:13, lineHeight:1.6 }}>Set a published US, UK or India market edition and its active price. Amounts are entered in major units; the system stores cents. Product files are not yet managed by this panel, so verify download fulfillment separately before selling.</p>
      <form onSubmit={savePrice} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
        <label style={{ display:'grid', gap:6, fontSize:12, fontWeight:750 }}>Product<select style={input} value={priceProductId} onChange={e=>setPriceProductId(e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label style={{ display:'grid', gap:6, fontSize:12, fontWeight:750 }}>Market<select style={input} value={priceMarket} onChange={e=>setPriceMarket(e.target.value)}><option value="US">United States · USD</option><option value="UK">United Kingdom · GBP</option><option value="IN">India · INR</option></select></label>
        <label style={{ display:'grid', gap:6, fontSize:12, fontWeight:750 }}>Price ({priceMarket==='US'?'USD':priceMarket==='UK'?'GBP':'INR'})<input style={input} type="number" min="0.01" max="1000000" step="0.01" value={priceAmount} onChange={e=>setPriceAmount(e.target.value)} required /></label>
        <div style={{ display:'flex', alignItems:'end' }}><button disabled={busy || products.length===0} type="submit" style={button}>{busy ? 'Saving…' : 'Save market price'}</button></div>
      </form>
    </section>
    <section style={{ background:'#fff', border:'1px solid #e7e9f1', borderRadius:18, overflow:'hidden' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:20,borderBottom:'1px solid #edf0f5' }}>
        <div><h2 style={{margin:0,fontSize:18}}>Product catalog</h2><p style={{margin:'5px 0 0',fontSize:12,color:'#778095'}}>{products.length} products loaded · Maximum 200 recent records</p></div>
        <button type="button" onClick={()=>void load()} disabled={busy} style={{...button,background:'#f0edff',color:'#5141d8'}}>Refresh</button>
      </div>
      {error && <p role="alert" style={{padding:'0 20px',color:'#a23a3a',fontSize:13}}>{error}</p>}
      {products.length===0 ? <p style={{padding:22,color:'#778095',fontSize:13}}>No products loaded yet.</p> :
        <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',minWidth:860,fontSize:12}}>
          <thead><tr>{['Product details','Type','Status','Action'].map(label=><th key={label} style={{textAlign:'left',padding:'12px 14px',background:'#fafbfe',color:'#687187',fontSize:10,letterSpacing:.5,borderBottom:'1px solid #edf0f5'}}>{label}</th>)}</tr></thead>
          <tbody>{products.map(product=><tr key={product.id}>
            <td style={{padding:14,borderBottom:'1px solid #f0f2f6',minWidth:300}}>
              <input aria-label={`Title for ${product.slug}`} style={{...input,fontWeight:750,marginBottom:7}} value={product.title} onChange={e=>setProducts(items=>items.map(p=>p.id===product.id?{...p,title:e.target.value}:p))}/>
              <textarea aria-label={`Description for ${product.slug}`} style={{...input,minHeight:58,resize:'vertical'}} value={product.description||''} onChange={e=>setProducts(items=>items.map(p=>p.id===product.id?{...p,description:e.target.value}:p))}/>
              <div style={{color:'#8991a3',marginTop:5,overflowWrap:'anywhere'}}>{product.slug}</div>
            </td>
            <td style={{padding:14,borderBottom:'1px solid #f0f2f6',minWidth:135}}><select style={input} value={product.product_type} onChange={e=>setProducts(items=>items.map(p=>p.id===product.id?{...p,product_type:e.target.value}:p))}>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></td>
            <td style={{padding:14,borderBottom:'1px solid #f0f2f6',minWidth:135}}><select style={input} value={product.status} onChange={e=>setProducts(items=>items.map(p=>p.id===product.id?{...p,status:e.target.value}:p))}><option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option></select><div style={{fontSize:10,color:'#8991a3',marginTop:6}}>Published items need a verified price and downloadable asset.</div></td>
            <td style={{padding:14,borderBottom:'1px solid #f0f2f6'}}><button type="button" disabled={busy} onClick={()=>void save(product)} style={button}>Save</button></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </div>;
}
