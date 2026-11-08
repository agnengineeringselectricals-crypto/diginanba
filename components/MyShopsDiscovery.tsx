'use client';

import { useEffect, useState, type CSSProperties } from 'react';

type Shop = { id:string; public_id:string|null; business_name:string; country_code:string; region_code:string|null; region?:string|null; city:string|null; locality:string|null; verification_status:string; average_rating:number|null; rating_count:number; listings?:{id:string;title:string;category:string;priceAmount:number|null;currency:string|null;priceUnit:string|null}[] };
const categories=['Groceries & Daily Needs','Vegetables & Fruits','Medical Shops & Pharmacy','Food, Bakery & Sweets','Clothing & Footwear','Mobile & Electronics','Electrical & Hardware','Home & Kitchen','Building Materials','Vehicle Spares','Stationery & Books','Beauty & Personal Care','Agriculture & Garden','Pet Supplies'];

export default function MyShopsDiscovery() {
  const [query,setQuery]=useState('');
  const [city,setCity]=useState('');
  const [category,setCategory]=useState('');
  const [items,setItems]=useState<Shop[]>([]);
  const [regular,setRegular]=useState<Shop[]>([]);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState('');
  const [inviteChannel,setInviteChannel]=useState<'whatsapp'|'email'|'other'>('whatsapp');
  const [inviteContact,setInviteContact]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    let cancelled=false;
    const timer=setTimeout(async()=>{
      setLoading(true);setError('');
      const params=new URLSearchParams();
      if(query.trim())params.set('q',query.trim());
      if(city.trim())params.set('city',city.trim());
      if(category)params.set('category',category);
      try{
        const response=await fetch('/api/marketplace/shops?'+params.toString());
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'Could not search shops.');
        if(!cancelled){setItems(data.items||[]);setRegular(data.regularShops||[]);}
      }catch(e){if(!cancelled){setItems([]);setError(e instanceof Error?e.message:'Could not search shops.');}}
      finally{if(!cancelled)setLoading(false);}
    },220);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[query,city,category]);

  async function inviteShop(){
    const contact=inviteContact.trim();
    if(inviteChannel==='whatsapp'&&!contact){setNotice('Enter the shop owner’s WhatsApp number, including country code.');return;}
    if(inviteChannel==='email'&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(contact)){setNotice('Enter a valid email address for the shop owner.');return;}
    const phoneDigits=contact.replace(/\\D/g,'');
    if(inviteChannel==='whatsapp'&&(phoneDigits.length<7||phoneDigits.length>15)){setNotice('Enter a valid phone number with country code.');return;}
    setNotice('Creating your invitation…');
    const shareWindow=inviteChannel==='whatsapp'?window.open('about:blank','_blank'):null;
    try{
      const response=await fetch('/api/marketplace/shop-invitations',{method:'POST'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Please sign in to invite a shop.');
      const link=window.location.origin+data.invitationPath;
      const message='Hello! I use DigiNanba to discover and connect with local shops. I would love to see your shop listed there. Join DigiNanba using this link: '+link;
      if(inviteChannel==='whatsapp'){
        const whatsapp='https://wa.me/'+phoneDigits+'?text='+encodeURIComponent(message);
        if(shareWindow)shareWindow.location.href=whatsapp;else window.location.href=whatsapp;
        setNotice('WhatsApp opened with the invitation addressed to '+contact+'. Review and send the message.');
      }else if(inviteChannel==='email'){
        window.location.href='mailto:'+encodeURIComponent(contact)+'?subject='+encodeURIComponent('Join DigiNanba — let customers find your shop')+'&body='+encodeURIComponent(message);
        setNotice('Your email app is opening with the invitation addressed to '+contact+'.');
      }else{
        if(navigator.share)await navigator.share({title:'Join DigiNanba',text:message,url:link});
        else{await navigator.clipboard.writeText(message);setNotice('Invitation copied. Paste it into WhatsApp or your preferred social app.');return;}
        setNotice('Choose your preferred social or messaging app and send the invitation.');
      }
    }catch(e){
      if(shareWindow)shareWindow.close();
      if(e instanceof Error&&e.name==='AbortError'){setNotice('Sharing cancelled.');return;}
      setNotice(e instanceof Error?e.message:'Could not create the invitation.');
    }
  }

  return <main style={{maxWidth:1160,margin:'0 auto',padding:'34px 20px 76px',color:'#172033'}}>
    <p style={{margin:'0 0 8px',color:'#5264b5',fontSize:12,fontWeight:800,letterSpacing:'.09em',textTransform:'uppercase'}}>DigiNanba local marketplace</p>
    <h1 style={{fontSize:'clamp(32px,5vw,46px)',lineHeight:1.1,margin:'0 0 10px'}}>My Shops</h1>
    <p style={{maxWidth:760,color:'#667085',lineHeight:1.6,margin:'0 0 24px'}}>Find the shops you regularly visit, discover nearby stores and connect with shop owners.</p>

    <section style={{marginBottom:28}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12}}>
        <h2 style={{fontSize:21,margin:0}}>My Regular Shops</h2>
        <span style={{fontSize:12,color:'#667085'}}>Your saved shops</span>
      </div>
      {regular.length ? <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:8}}>
        {regular.map(shop=><a key={shop.id} href={shop.public_id?'/s/'+shop.public_id:'#'} style={{minWidth:190,maxWidth:220,textDecoration:'none',color:'#172033',border:'1px solid #e4e7ec',borderRadius:15,padding:14,background:'#fff'}}>
          <div style={{fontSize:26,marginBottom:8}}>🏪</div><strong>{shop.business_name}</strong>
          <div style={{fontSize:12,color:'#667085',marginTop:4}}>{[shop.locality,shop.city].filter(Boolean).join(' · ')}</div>
          <div style={{fontSize:12,color:'#475467',marginTop:7}}>{shop.public_id||'DigiNanba shop'}</div>
          <div style={{fontSize:12,color:'#a66b12',marginTop:5}}>{shop.average_rating!=null?'★ '+Number(shop.average_rating).toFixed(1)+' ('+shop.rating_count+')':'New shop · No ratings yet'}</div>
        </a>)}
      </div>:<div style={{border:'1px dashed #d0d5dd',borderRadius:14,padding:17,color:'#667085',fontSize:14}}>Your regular shops will appear here. Search for a shop below and save it, or invite your regular shop owner to join DigiNanba.</div>}
    </section>

    <section id="invite-shop-panel" style={{margin:'0 0 20px',padding:'16px',border:'1px solid #b7dfca',borderRadius:16,background:'linear-gradient(135deg,#f1faf5,#fff)',display:'grid',gap:11}}>
      <div><strong style={{display:'block',color:'#145c3f',fontSize:17}}>Can't find your regular shop? Invite them to DigiNanba.</strong><span style={{fontSize:13,color:'#526b5e'}}>Enter the shop owner's WhatsApp number or email, or share through another social app.</span></div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(130px,.7fr) minmax(190px,1.3fr)',gap:9}}>
        <select aria-label="Invitation method" value={inviteChannel} onChange={e=>setInviteChannel(e.target.value as 'whatsapp'|'email'|'other')} style={field}>
          <option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="other">Other social apps</option>
        </select>
        {inviteChannel!=='other'?<input aria-label={inviteChannel==='whatsapp'?'Shop owner WhatsApp number':'Shop owner email address'} type={inviteChannel==='email'?'email':'tel'} value={inviteContact} onChange={e=>setInviteContact(e.target.value)} placeholder={inviteChannel==='whatsapp'?'Phone with country code (e.g. +91…)':'Shop owner email address'} style={field}/>:<div style={{...field,display:'flex',alignItems:'center',color:'#667085',fontSize:13}}>Opens your device's share options</div>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <button type="button" onClick={inviteShop} style={primaryButton}>Invite shop owner {inviteChannel==='whatsapp'?'on WhatsApp':inviteChannel==='email'?'by Email':'via social apps'}</button>
        <span style={{fontSize:12,color:'#667085'}}>The owner reviews and sends the invitation; nothing is sent automatically.</span>
      </div>
      {notice?<p role="status" style={{margin:0,fontSize:13,color:'#475467'}}>{notice}</p>:null}
    </section>

    <section style={{padding:'clamp(18px,3vw,26px)',border:'1px solid #e4e7ec',borderRadius:20,background:'linear-gradient(135deg,#f7f9ff,#fff 70%)',boxShadow:'0 8px 24px rgba(16,24,40,.04)'}}>
      <h2 style={{fontSize:21,margin:'0 0 14px'}}>What are you looking for?</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:10}}>
        <input aria-label="Search by shop name, product or shop ID" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Shop name, product or Shop ID (e.g. TN-7K9MQ)" style={field}/>
        <input aria-label="City or area" value={city} onChange={e=>setCity(e.target.value)} placeholder="City or area" style={field}/>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:15}}>
        <button type="button" onClick={()=>setCategory('')} style={chip(!category)} >All shops</button>
        {categories.map(x=><button type="button" key={x} onClick={()=>setCategory(category===x?'':x)} style={chip(category===x)}>{x}</button>)}
      </div>
    </section>

    <section style={{marginTop:28}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10}}>
        <h2 style={{fontSize:21,margin:0}}>{category||'Shops you can explore'}</h2>
        <span style={{fontSize:12,color:'#667085'}}>{loading?'Searching…':items.length+' shops'}</span>
      </div>
      {error?<p role="alert" style={{color:'#b42318'}}>{error}</p>:null}
      {!loading&&query.trim()&&!items.length&&!error?<div style={{marginTop:14,padding:14,border:'1px dashed #b7dfca',borderRadius:14,background:'#f7fcf8'}}>
        <strong>Shop not listed on DigiNanba yet?</strong>
        <p style={{margin:'5px 0 0',fontSize:13,color:'#526b5e'}}>You can invite the owner directly using the WhatsApp number or email box above.</p>
      </div>:null}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:13,marginTop:14}}>
        {items.map(shop=><article key={shop.id} style={{border:'1px solid #e4e7ec',borderRadius:16,padding:17,background:'#fff',display:'grid',gap:8}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
            <h3 style={{margin:0,fontSize:18}}>{shop.business_name}</h3>
            <span style={{fontSize:11,color:shop.verification_status==='verified'?'#027a48':'#667085',whiteSpace:'nowrap'}}>{shop.verification_status==='verified'?'✓ Verified':'New on DigiNanba'}</span>
          </div>
          <div style={{fontSize:12,color:'#667085'}}>{[shop.locality,shop.city,shop.region].filter(Boolean).join(' · ')}</div>
          <div style={{fontSize:12,color:'#344054',fontWeight:650}}>{shop.public_id||'ID pending'}</div>
          <div style={{fontSize:13,color:'#a66b12'}}>{shop.average_rating!=null?'★ '+Number(shop.average_rating).toFixed(1)+' · '+shop.rating_count+' ratings':'No ratings yet'}</div>
          {shop.listings?.length?<div style={{borderTop:'1px solid #eaecf0',paddingTop:9,display:'grid',gap:6}}>{shop.listings.slice(0,3).map(p=><div key={p.id} style={{fontSize:13}}><strong>{p.title}</strong><div style={{fontSize:11,color:'#667085'}}>{p.category}{p.priceAmount!=null?' · '+(p.currency||'')+' '+p.priceAmount+(p.priceUnit?' / '+p.priceUnit:''):''}</div></div>)}</div>:<div style={{fontSize:12,color:'#667085'}}>Shop profile is available. Product catalogue is being added.</div>}
          {shop.public_id?<a href={'/s/'+shop.public_id} style={{justifySelf:'start',marginTop:4,color:'#2454c6',fontWeight:700,fontSize:13,textDecoration:'none'}}>Visit shop →</a>:null}
        </article>)}
      </div>
    </section>
  </main>;
}

const field:CSSProperties={width:'100%',boxSizing:'border-box',padding:'13px 14px',border:'1px solid #d0d5dd',borderRadius:12,background:'#fff',color:'#172033',font:'inherit'};
const primaryButton:React.CSSProperties={border:0,borderRadius:999,padding:'11px 17px',background:'#176b4d',color:'#fff',fontWeight:750,cursor:'pointer'};
function chip(active:boolean):React.CSSProperties{return{border:'1px solid '+(active?'#263c91':'#d0d5dd'),borderRadius:999,padding:'8px 12px',background:active?'#263c91':'#fff',color:active?'#fff':'#344054',fontSize:12,cursor:'pointer'}}
