'use client';

import { useEffect, useState, type CSSProperties } from 'react';

type Shop = { id:string; public_id:string|null; business_name:string; country_code:string; region_code:string|null; region?:string|null; city:string|null; locality:string|null; verification_status:string; average_rating:number|null; rating_count:number; listings?:{id:string;title:string;category:string;priceAmount:number|null;currency:string|null;priceUnit:string|null}[] };
const categories=['Groceries & Daily Needs','Vegetables & Fruits','Medical Shops & Pharmacy','Food, Bakery & Sweets','Clothing & Footwear','Mobile & Electronics','Electrical & Hardware','Home & Kitchen','Building Materials','Vehicle Spares','Stationery & Books','Beauty & Personal Care','Agriculture & Garden','Pet Supplies'];

export default function MyShopsDiscovery() {
  const [query,setQuery]=useState('');
  const [city,setCity]=useState('');
  const [countryCode,setCountryCode]=useState('IN');
  const [category,setCategory]=useState('');
  const [productSuggestions,setProductSuggestions]=useState<{title:string;category:string}[]>([]);
  const [shopSuggestions,setShopSuggestions]=useState<{business_name:string;public_id:string|null;city:string|null;district:string|null;region:string|null}[]>([]);
  const [locationSuggestions,setLocationSuggestions]=useState<{value:string;kind:string;city:string|null;town:string|null;village:string|null;district:string|null;state:string|null;country:string|null;region:string|null}[]>([]);
  const [productSuggestionsOpen,setProductSuggestionsOpen]=useState(false);
  const [locationSuggestionsOpen,setLocationSuggestionsOpen]=useState(false);
  const [selectedProduct,setSelectedProduct]=useState('');
  const [selectedLocation,setSelectedLocation]=useState('');
  const [items,setItems]=useState<Shop[]>([]);
  const [favourites,setFavourites]=useState<Shop[]>([]);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState('');
  const [inviteChannel,setInviteChannel]=useState<'whatsapp'|'email'|'x'|'instagram'|'facebook'|'telegram'>('whatsapp');
  const [inviteContact,setInviteContact]=useState('');
  const [countryDialCode,setCountryDialCode]=useState('+91');
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    const localeRegion=navigator.language.match(/-([A-Z]{2})(?:-|$)/i)?.[1]?.toUpperCase();
    const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dialCodes:Record<string,string>={IN:'+91',US:'+1',CA:'+1',GB:'+44',AU:'+61',NZ:'+64',AE:'+971',SG:'+65',MY:'+60',LK:'+94',BD:'+880',NP:'+977',SA:'+966',QA:'+974',OM:'+968',ZA:'+27',DE:'+49',FR:'+33',JP:'+81',KR:'+82',CN:'+86',IE:'+353',IT:'+39',ES:'+34',NL:'+31',BE:'+32',CH:'+41',AT:'+43',SE:'+46',NO:'+47',DK:'+45',FI:'+358',BR:'+55',MX:'+52',ID:'+62',PH:'+63',TH:'+66',VN:'+84',PK:'+92',KW:'+965',BH:'+973',TR:'+90'};
    const zoneDialCodes:Record<string,string>={'Asia/Kolkata':'+91','Asia/Colombo':'+94','Asia/Dhaka':'+880','Asia/Kathmandu':'+977','Asia/Dubai':'+971','Asia/Singapore':'+65','Asia/Kuala_Lumpur':'+60','Asia/Riyadh':'+966','Asia/Qatar':'+974','Asia/Muscat':'+968','Europe/London':'+44','Australia/Sydney':'+61','Pacific/Auckland':'+64'};
    const fallback=zoneDialCodes[timezone]||(localeRegion?dialCodes[localeRegion]:undefined)||'+91';
    fetch('/api/marketplace/geo').then(r=>r.ok?r.json():null).then(data=>{
      if(!active)return;
      const country=String(data?.countryCode||localeRegion||'IN').toUpperCase();
      if(/^[A-Z]{2}$/.test(country))setCountryCode(country);
      setCountryDialCode(dialCodes[country]||fallback);
    }).catch(()=>{if(active)setCountryDialCode(fallback);});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    let cancelled=false;
    const term=query.trim();
    if(term.length<2||term===selectedProduct){setProductSuggestions([]);setShopSuggestions([]);setProductSuggestionsOpen(false);return;}
    const timer=setTimeout(async()=>{
      try{
        const [productsResponse,shopsResponse]=await Promise.all([
          fetch('/api/marketplace/shops/suggestions?type=products&q='+encodeURIComponent(term)),
          fetch('/api/marketplace/shops/suggestions?type=shops&q='+encodeURIComponent(term))
        ]);
        const [productsData,shopsData]=await Promise.all([productsResponse.json(),shopsResponse.json()]);
        if(!cancelled){setProductSuggestions(productsData.suggestions||[]);setShopSuggestions(shopsData.suggestions||[]);setProductSuggestionsOpen(true);}
      }catch{if(!cancelled){setProductSuggestions([]);setShopSuggestions([]);}}
    },180);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[query,selectedProduct]);

  useEffect(()=>{
    let cancelled=false;
    const term=city.trim();
    if(term.length<2||term===selectedLocation){setLocationSuggestions([]);setLocationSuggestionsOpen(false);return;}
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch('/api/marketplace/shops/suggestions?type=locations&country='+encodeURIComponent(countryCode)+'&q='+encodeURIComponent(term));
        const data=await response.json();
        if(!cancelled){setLocationSuggestions(data.suggestions||[]);setLocationSuggestionsOpen(true);}
      }catch{if(!cancelled)setLocationSuggestions([]);}
    },180);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[city,selectedLocation,countryCode]);

  useEffect(()=>{
    let cancelled=false;
    fetch('/api/marketplace/connections').then(response=>response.json()).then((data:{shops?:Array<Shop & {is_pinned?:boolean}>})=>{if(!cancelled)setFavourites((data.shops||[]).filter(item=>item.is_pinned));}).catch(()=>undefined);
    return()=>{cancelled=true;};
  },[]);

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
        if(!cancelled){setItems(data.items||[]);}
      }catch(e){if(!cancelled){setItems([]);setError(e instanceof Error?e.message:'Could not search shops.');}}
      finally{if(!cancelled)setLoading(false);}
    },220);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[query,city,category]);

  async function inviteShop(){
    const contact=inviteContact.trim();
    if(inviteChannel==='whatsapp'){
      const localDigits=contact.replace(/\\D/g,'');
      if(localDigits.length!==10){setNotice('Enter the 10-digit mobile number. Select the country code separately.');return;}
    }
    if(inviteChannel==='email'&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(contact)){setNotice('Enter a valid email address for the shop owner.');return;}
    setNotice('Creating your invitation…');
    const shareWindow=inviteChannel==='whatsapp'?window.open('about:blank','_blank'):null;
    try{
      const response=await fetch('/api/marketplace/shop-invitations',{method:'POST'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Please sign in to invite a shop.');
      const link=window.location.origin+data.invitationPath;
      const message='Hello! I use DigiNanba to discover and connect with local shops. I would love to see your shop listed there. Join DigiNanba using this link: '+link;
      const encodedMessage=encodeURIComponent(message);
      if(inviteChannel==='whatsapp'){
        const fullPhone=countryDialCode.replace(/\\D/g,'')+contact.replace(/\\D/g,'');
        const whatsapp='https://wa.me/'+fullPhone+'?text='+encodedMessage;
        if(shareWindow)shareWindow.location.href=whatsapp;else window.location.href=whatsapp;
        setNotice('WhatsApp opened with the invitation addressed to '+countryDialCode+' '+contact+'. Review and send the message.');
      }else if(inviteChannel==='email'){
        window.location.href='mailto:'+contact+'?subject='+encodeURIComponent('Join DigiNanba — let customers find your shop')+'&body='+encodedMessage;
        setNotice('Your email app is opening with the invitation addressed to '+contact+'.');
      }else if(inviteChannel==='x'){
        window.open('https://twitter.com/intent/tweet?text='+encodedMessage,'_blank','noopener,noreferrer');
        setNotice('X (Twitter) opened with your invitation ready to post.');
      }else if(inviteChannel==='facebook'){
        window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link)+'&quote='+encodedMessage,'_blank','noopener,noreferrer');
        setNotice('Facebook opened with your DigiNanba invitation link ready to share.');
      }else if(inviteChannel==='telegram'){
        window.open('https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodedMessage,'_blank','noopener,noreferrer');
        setNotice('Telegram opened with your invitation ready to share.');
      }else{
        if(navigator.share)await navigator.share({title:'Join DigiNanba',text:message,url:link});
        else{await navigator.clipboard.writeText(message);setNotice('Invitation copied. Paste it into Instagram to share with the shop owner.');return;}
        setNotice('Choose Instagram from your device share options and send the invitation.');
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


    <section id="favourite-shops" style={{marginBottom:28}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12}}>
        <h2 style={{fontSize:21,margin:0}}>My Favourite Shops</h2>
        <span style={{fontSize:12,color:'#667085'}}>Your pinned shops</span>
      </div>
      {favourites.length ? <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:8}}>
        {favourites.map(shop=><a key={shop.id} href={shop.public_id?'/s/'+shop.public_id:'#'} style={{minWidth:190,maxWidth:220,textDecoration:'none',color:'#172033',border:'1px solid #e4e7ec',borderRadius:15,padding:14,background:'#fff'}}>
          <div style={{fontSize:26,marginBottom:8}}>⭐</div><strong>{shop.business_name}</strong>
          <div style={{fontSize:12,color:'#667085',marginTop:4}}>{[shop.locality,shop.city].filter(Boolean).join(' · ')}</div>
          <div style={{fontSize:12,color:'#475467',marginTop:7}}>{shop.public_id||'DigiNanba shop'}</div>
        </a>)}
      </div>:<div style={{border:'1px dashed #d0d5dd',borderRadius:14,padding:17,color:'#667085',fontSize:14}}>Your favourite shops will appear here when you pin a connected shop.</div>}
    </section>


    <section id="invite-shop-panel" style={{margin:'0 0 20px',padding:'16px',border:'1px solid #b7dfca',borderRadius:16,background:'linear-gradient(135deg,#f1faf5,#fff)',display:'grid',gap:11}}>
      <div><strong style={{display:'block',color:'#145c3f',fontSize:17}}>Can't find your regular shop? Invite them to DigiNanba.</strong><span style={{fontSize:13,color:'#526b5e'}}></span></div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(130px,.7fr) minmax(190px,1.3fr)',gap:9}}>
        <select aria-label="Invitation method" value={inviteChannel} onChange={e=>setInviteChannel(e.target.value as 'whatsapp'|'email'|'x'|'instagram'|'facebook'|'telegram')} style={field}>
          <option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="x">X (Twitter)</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="telegram">Telegram</option>
        </select>
        {inviteChannel==='whatsapp'?<div style={{display:'grid',gridTemplateColumns:'minmax(105px,.7fr) minmax(110px,1.3fr)',gap:8}}>
          <select aria-label="Country calling code" value={countryDialCode} onChange={e=>setCountryDialCode(e.target.value)} style={field}>
            <option value="+91">🇮🇳 +91</option><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option><option value="+61">🇦🇺 +61</option><option value="+971">🇦🇪 +971</option><option value="+65">🇸🇬 +65</option><option value="+60">🇲🇾 +60</option><option value="+94">🇱🇰 +94</option><option value="+880">🇧🇩 +880</option><option value="+977">🇳🇵 +977</option><option value="+966">🇸🇦 +966</option><option value="+974">🇶🇦 +974</option><option value="+968">🇴🇲 +968</option><option value="+27">🇿🇦 +27</option><option value="+49">🇩🇪 +49</option><option value="+33">🇫🇷 +33</option><option value="+81">🇯🇵 +81</option><option value="+82">🇰🇷 +82</option><option value="+86">🇨🇳 +86</option><option value="+64">🇳🇿 +64</option><option value="+353">🇮🇪 +353</option><option value="+39">🇮🇹 +39</option><option value="+34">🇪🇸 +34</option><option value="+31">🇳🇱 +31</option><option value="+32">🇧🇪 +32</option><option value="+41">🇨🇭 +41</option><option value="+43">🇦🇹 +43</option><option value="+46">🇸🇪 +46</option><option value="+47">🇳🇴 +47</option><option value="+45">🇩🇰 +45</option><option value="+358">🇫🇮 +358</option><option value="+55">🇧🇷 +55</option><option value="+52">🇲🇽 +52</option><option value="+62">🇮🇩 +62</option><option value="+63">🇵🇭 +63</option><option value="+66">🇹🇭 +66</option><option value="+84">🇻🇳 +84</option><option value="+92">🇵🇰 +92</option><option value="+965">🇰🇼 +965</option><option value="+973">🇧🇭 +973</option><option value="+90">🇹🇷 +90</option>
          </select>
          <input aria-label="Shop owner's 10-digit mobile number" type="tel" inputMode="numeric" maxLength={10} value={inviteContact} onChange={e=>setInviteContact(e.target.value.replace(/\\D/g,'').slice(0,10))} placeholder="10-digit mobile number" style={field}/>
        </div>:inviteChannel==='email'?<input aria-label="Shop owner email address" type="email" value={inviteContact} onChange={e=>setInviteContact(e.target.value)} placeholder="Shop owner email address" style={field}/>:<div style={{...field,display:'flex',alignItems:'center',color:'#667085',fontSize:13}}>{inviteChannel==='instagram'?'Instagram share via your device share options':inviteChannel==='x'?'Post invitation on X (Twitter)':inviteChannel==='facebook'?'Share invitation on Facebook':'Share invitation on Telegram'}</div>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <button type="button" onClick={inviteShop} style={primaryButton}>Invite shop owner {inviteChannel==='whatsapp'?'on WhatsApp':inviteChannel==='email'?'by Email':inviteChannel==='x'?'on X':inviteChannel==='instagram'?'on Instagram':inviteChannel==='facebook'?'on Facebook':'on Telegram'}</button>
        
      </div>
      {notice?<p role="status" style={{margin:0,fontSize:13,color:'#475467'}}>{notice}</p>:null}
    </section>

    <section style={{padding:'clamp(18px,3vw,26px)',border:'1px solid #e4e7ec',borderRadius:20,background:'linear-gradient(135deg,#f7f9ff,#fff 70%)',boxShadow:'0 8px 24px rgba(16,24,40,.04)'}}>
      <h2 style={{fontSize:21,margin:'0 0 14px'}}>What are you looking for?</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:10,alignItems:'start'}}>
        <div style={{position:'relative'}}>
          <input aria-label="Search by shop name, product, shop ID, phone, WhatsApp or GST number" value={query} onFocus={()=>{if(query.trim().length>=2)setProductSuggestionsOpen(true);}} onChange={e=>{setSelectedProduct('');setQuery(e.target.value);}} placeholder="Shop name, product, Shop ID, phone / WhatsApp or GST number" style={field}/>
          {productSuggestionsOpen&&(shopSuggestions.length>0||productSuggestions.length>0)?<div role="listbox" aria-label="Matching shops and products" style={suggestionPanel}>
            {shopSuggestions.length>0?<div style={{padding:'8px 12px',fontSize:11,fontWeight:800,color:'#5264b5',background:'#f7f8fc'}}>SHOPS</div>:null}
            {shopSuggestions.map((item,index)=><button type="button" role="option" aria-selected="false" key={'shop-'+item.public_id+'-'+index} onClick={()=>{const value=item.business_name;setSelectedProduct(value);setQuery(value);setShopSuggestions([]);setProductSuggestions([]);setProductSuggestionsOpen(false);}} style={suggestionButton}>
              <span style={{fontWeight:700,color:'#172033'}}>🏪 {item.business_name}</span><span style={{fontSize:11,color:'#667085'}}>{[item.public_id,item.city,item.district,item.region].filter(Boolean).join(' · ')}</span>
            </button>)}
            {productSuggestions.length>0?<div style={{padding:'8px 12px',fontSize:11,fontWeight:800,color:'#5264b5',background:'#f7f8fc'}}>PRODUCTS</div>:null}
            {productSuggestions.map((item,index)=><button type="button" role="option" aria-selected="false" key={'product-'+item.title+'-'+item.category+'-'+index} onClick={()=>{setSelectedProduct(item.title);setQuery(item.title);setShopSuggestions([]);setProductSuggestions([]);setProductSuggestionsOpen(false);}} style={suggestionButton}>
              <span style={{fontWeight:700,color:'#172033'}}>{item.title}</span><span style={{fontSize:11,color:'#667085'}}>{item.category}</span>
            </button>)}
          </div>:null}
        </div>
        <div style={{position:'relative'}}>
          <input aria-label="City, town, village, street or local area" value={city} onFocus={()=>{if(city.trim().length>=2)setLocationSuggestionsOpen(true);}} onChange={e=>{setSelectedLocation('');setCity(e.target.value);}} placeholder="City, village or area (e.g. Sai Nagar, Puttaparthi)" style={field}/>
          {locationSuggestionsOpen&&locationSuggestions.length>0?<div role="listbox" aria-label="Matching locations" style={suggestionPanel}>
            {locationSuggestions.map((item,index)=><button type="button" role="option" aria-selected="false" key={item.kind+'-'+item.value+'-'+index} onClick={()=>{setSelectedLocation(item.value);setCity(item.value);setLocationSuggestions([]);setLocationSuggestionsOpen(false);}} style={suggestionButton}>
              <span style={{fontWeight:700,color:'#172033'}}>{item.value}</span><span style={{fontSize:11,color:'#667085'}}>{[
                item.kind,
                item.city ? item.city+' (City)' : null,
                item.town ? item.town+' (Town)' : null,
                item.village ? item.village+' (Village)' : null,
                item.district ? item.district+' (District)' : null,
                item.state ? item.state+' (State)' : item.region ? item.region+' (State)' : null,
                item.country ? item.country+' (Country)' : null
              ].filter(Boolean).join(' · ')}</span>
            </button>)}
          </div>:null}
        </div>
      </div>
      <p style={{margin:'7px 0 0',fontSize:10,color:'#667085'}}>Location data attribution: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{color:'inherit'}}>© OpenStreetMap contributors (ODbL)</a> · <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" style={{color:'inherit'}}>GeoNames (CC BY 4.0)</a></p>
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
        <p style={{margin:'5px 0 0',fontSize:13,color:'#526b5e'}}>You can invite the owner directly using the WhatsApp number, email, X, Instagram, Facebook or Telegram options above.</p>
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
const suggestionPanel:CSSProperties={position:'absolute',zIndex:30,top:'calc(100% + 5px)',left:0,right:0,maxHeight:260,overflowY:'auto',border:'1px solid #d0d5dd',borderRadius:12,background:'#fff',boxShadow:'0 12px 28px rgba(16,24,40,.14)'};
const suggestionButton:CSSProperties={width:'100%',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:3,padding:'11px 13px',border:0,borderBottom:'1px solid #f0f1f3',background:'#fff',textAlign:'left',cursor:'pointer',font:'inherit'};
const primaryButton:React.CSSProperties={border:0,borderRadius:999,padding:'11px 17px',background:'#176b4d',color:'#fff',fontWeight:750,cursor:'pointer'};
function chip(active:boolean):React.CSSProperties{return{border:'1px solid '+(active?'#263c91':'#d0d5dd'),borderRadius:999,padding:'8px 12px',background:active?'#263c91':'#fff',color:active?'#fff':'#344054',fontSize:12,cursor:'pointer'}}
