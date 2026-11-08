'use client';

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';

const regions: Record<string, { name: string; code: string }[]> = {
  IN: [
    {name:'Tamil Nadu',code:'TN'},{name:'Kerala',code:'KL'},{name:'Karnataka',code:'KA'},{name:'Andhra Pradesh',code:'AP'},{name:'Telangana',code:'TS'},
    {name:'Maharashtra',code:'MH'},{name:'Gujarat',code:'GJ'},{name:'Delhi',code:'DL'},{name:'Uttar Pradesh',code:'UP'},{name:'West Bengal',code:'WB'},
    {name:'Rajasthan',code:'RJ'},{name:'Madhya Pradesh',code:'MP'},{name:'Punjab',code:'PB'},{name:'Haryana',code:'HR'},{name:'Odisha',code:'OD'},
    {name:'Bihar',code:'BR'},{name:'Assam',code:'AS'},{name:'Goa',code:'GA'},{name:'Jharkhand',code:'JH'},{name:'Chhattisgarh',code:'CG'},
    {name:'Himachal Pradesh',code:'HP'},{name:'Uttarakhand',code:'UK'},{name:'Jammu and Kashmir',code:'JK'},{name:'Ladakh',code:'LA'},
    {name:'Puducherry',code:'PY'},{name:'Chandigarh',code:'CH'},{name:'Tripura',code:'TR'},{name:'Meghalaya',code:'ML'},{name:'Manipur',code:'MN'},
    {name:'Nagaland',code:'NL'},{name:'Arunachal Pradesh',code:'AR'},{name:'Mizoram',code:'MZ'},{name:'Sikkim',code:'SK'}
  ],
  US: ['Alabama:AL','Alaska:AK','Arizona:AZ','Arkansas:AR','California:CA','Colorado:CO','Connecticut:CT','Delaware:DE','Florida:FL','Georgia:GA','Hawaii:HI','Idaho:ID','Illinois:IL','Indiana:IN','Iowa:IA','Kansas:KS','Kentucky:KY','Louisiana:LA','Maine:ME','Maryland:MD','Massachusetts:MA','Michigan:MI','Minnesota:MN','Mississippi:MS','Missouri:MO','Montana:MT','Nebraska:NE','Nevada:NV','New Hampshire:NH','New Jersey:NJ','New Mexico:NM','New York:NY','North Carolina:NC','North Dakota:ND','Ohio:OH','Oklahoma:OK','Oregon:OR','Pennsylvania:PA','Rhode Island:RI','South Carolina:SC','South Dakota:SD','Tennessee:TN','Texas:TX','Utah:UT','Vermont:VT','Virginia:VA','Washington:WA','West Virginia:WV','Wisconsin:WI','Wyoming:WY'].map(v=>({name:v.split(':')[0],code:v.split(':')[1]})),
  GB: [{name:'England',code:'EN'},{name:'Scotland',code:'SC'},{name:'Wales',code:'WL'},{name:'Northern Ireland',code:'NI'}],
  AU: [{name:'New South Wales',code:'NS'},{name:'Victoria',code:'VI'},{name:'Queensland',code:'QL'},{name:'Western Australia',code:'WA'},{name:'South Australia',code:'SA'},{name:'Tasmania',code:'TA'},{name:'Australian Capital Territory',code:'AC'},{name:'Northern Territory',code:'NT'}],
  CA: [{name:'Ontario',code:'ON'},{name:'Quebec',code:'QC'},{name:'British Columbia',code:'BC'},{name:'Alberta',code:'AB'},{name:'Manitoba',code:'MB'},{name:'Saskatchewan',code:'SK'},{name:'Nova Scotia',code:'NS'},{name:'New Brunswick',code:'NB'},{name:'Newfoundland and Labrador',code:'NL'},{name:'Prince Edward Island',code:'PE'}]
};

export default function ShopRegistration({ invitationCode }: { invitationCode: string }) {
  const [shopName,setShopName]=useState('');
  const [country,setCountry]=useState('IN');
  const [regionCode,setRegionCode]=useState('TN');
  const [regionName,setRegionName]=useState('Tamil Nadu');
  const [city,setCity]=useState('');
  const [address,setAddress]=useState('');
  const [phone,setPhone]=useState('');
  const [email,setEmail]=useState('');
  const [coords,setCoords]=useState<{lat:number;lng:number}|null>(null);
  const [business,setBusiness]=useState<{id:string;public_id:string;business_name:string}|null>(null);
  const [productName,setProductName]=useState('');
  const [productCategory,setProductCategory]=useState('Groceries & Daily Needs');
  const [price,setPrice]=useState('');
  const [unit,setUnit]=useState('piece');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const regionOptions=useMemo(()=>regions[country]||[],[country]);
  const shopUrl=business ? 'https://www.diginanba.com/s/'+business.public_id : '';
  const currency=country==='IN'?'INR':country==='GB'?'GBP':country==='AU'?'AUD':country==='CA'?'CAD':'USD';

  function selectRegion(code:string) {
    setRegionCode(code);
    setRegionName(regionOptions.find(x=>x.code===code)?.name || '');
  }
  function useLocation() {
    if (!navigator.geolocation) { setNotice('Location is not available on this device. Please enter the address.'); return; }
    setNotice('Getting your current location…');
    navigator.geolocation.getCurrentPosition(position=>{
      const lat=Number(position.coords.latitude.toFixed(6)),lng=Number(position.coords.longitude.toFixed(6));
      setCoords({lat,lng});
      setNotice('Location pin saved. Please confirm or enter the shop address below.');
      window.open('https://www.google.com/maps/search/?api=1&query='+lat+','+lng,'_blank','noopener,noreferrer');
    },()=>setNotice('Could not access location. Please allow location permission or enter the address.'),{enableHighAccuracy:true,timeout:12000});
  }
  async function registerShop(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setNotice('');
    try {
      const response=await fetch('/api/marketplace/shops',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        businessName:shopName,countryCode:country,regionCode,region:regionName,city,addressLine:address,phone:phone||undefined,email:email||undefined,invitationCode:invitationCode||undefined,
        latitude:coords?.lat,longitude:coords?.lng,description:''
      })});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Could not register the shop.');
      setBusiness(data.business);setNotice(data.message||'Your shop is registered. You can start adding products.');
    } catch(error) { setNotice(error instanceof Error?error.message:'Could not register the shop. Please try again.'); }
    finally {setBusy(false);}
  }
  async function addProduct(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!business)return;setBusy(true);setNotice('');
    try {
      const response=await fetch('/api/marketplace/shops',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({
        businessId:business.id,title:productName,description:'',category:productCategory,listingType:'physical_product',
        priceAmount:price.trim()?Number(price):undefined,currency:price.trim()?currency:undefined,priceUnit:unit
      })});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Could not add the product.');
      setProductName('');setPrice('');setNotice(data.message||'Product added to your shop.');
    } catch(error) {setNotice(error instanceof Error?error.message:'Could not add the product.');}
    finally {setBusy(false);}
  }

  return <main style={{maxWidth:760,margin:'0 auto',padding:'36px 18px 72px',color:'#172033'}}>
    <header style={{textAlign:'center',marginBottom:26}}>
      <div style={{fontSize:32}}>🏪</div><h1 style={{fontSize:32,margin:'8px 0'}}>Welcome to DigiNanba</h1>
      <p style={{color:'#667085',margin:0}}>A simple way for customers to find your shop and the products you offer.</p>
    </header>
    {!business ? <form onSubmit={registerShop} style={{border:'1px solid #e4e7ec',borderRadius:20,padding:22,display:'grid',gap:15,background:'#fff'}}>
      <h2 style={{fontSize:21,margin:0}}>Register your shop</h2>
      <p style={{color:'#667085',fontSize:13,margin:0}}>Just the basic details to get started. You can add contact information and more details later in your shop settings.</p>
      <label style={{display:'grid',gap:6,fontWeight:650,fontSize:14}}>Shop name *
        <input required minLength={2} maxLength={160} value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="Your shop name" style={field}/>
      </label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
        <label style={{display:'grid',gap:6,fontWeight:650,fontSize:14}}>Country *
          <select value={country} onChange={e=>{setCountry(e.target.value);setRegionCode('');setRegionName('');}} style={field}>
            <option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="AU">Australia</option><option value="CA">Canada</option>
          </select>
        </label>
        <label style={{display:'grid',gap:6,fontWeight:650,fontSize:14}}>State / region *
          <select required value={regionCode} onChange={e=>selectRegion(e.target.value)} style={field}>
            <option value="">Select state / region</option>{regionOptions.map(r=><option key={r.code} value={r.code}>{r.name} ({r.code})</option>)}
          </select>
        </label>
      </div>
      <label style={{display:'grid',gap:6,fontWeight:650,fontSize:14}}>City / town
        <input value={city} onChange={e=>setCity(e.target.value)} placeholder="City or town" style={field}/>
      </label>
      <label style={{display:'grid',gap:6,fontWeight:650,fontSize:14}}>Shop address *
        <textarea required minLength={5} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Door number, street, area and landmark" rows={3} style={{...field,resize:'vertical'}}/>
      </label>
      <button type="button" onClick={useLocation} style={secondaryButton}>📍 Use my current location on Google Maps</button>
      {coords ? <small style={{color:'#027a48'}}>Location pin saved: {coords.lat}, {coords.lng}</small> : null}
      <div style={{borderTop:'1px solid #eaecf0',paddingTop:13,display:'grid',gap:12}}>
        <strong>Contact details (optional)</strong>
        <label style={{display:'grid',gap:6,fontSize:14}}>Phone number
          <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="You can add this later" style={field}/>
        </label>
        <label style={{display:'grid',gap:6,fontSize:14}}>Email address
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="You can add this later" style={field}/>
        </label>
      </div>
      {notice?<p role="status" style={{margin:0,color:'#475467',fontSize:13}}>{notice}</p>:null}
      <button disabled={busy} type="submit" style={primaryButton}>{busy?'Registering…':'Register My Shop'}</button>
      <small style={{color:'#667085',lineHeight:1.5}}>Your shop can start listing products immediately. Verification is separate; a verification badge is shown only after checks are completed.</small>
    </form> : <section style={{border:'1px solid #d1fadf',borderRadius:20,padding:22,display:'grid',gap:16,background:'#f6fef9'}}>
      <div><div style={{fontSize:13,color:'#027a48',fontWeight:800}}>SHOP REGISTERED</div><h2 style={{fontSize:24,margin:'6px 0'}}>{business.business_name}</h2><div style={{fontSize:12,color:'#667085'}}>Your DigiNanba Shop ID</div><div style={{fontSize:30,fontWeight:850,letterSpacing:2,color:'#027a48'}}>{business.public_id}</div></div>
      <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:16,alignItems:'center'}}>
        <img alt="QR code to open this shop" width="160" height="160" src={'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(shopUrl)} style={{background:'#fff',padding:8,borderRadius:12}}/>
        <div><strong>Share your shop</strong><p style={{fontSize:13,color:'#667085'}}>Customers can scan this QR code or open your shop link to find your products.</p><a href={shopUrl} target="_blank" rel="noreferrer" style={{color:'#2454c6',wordBreak:'break-all'}}>{shopUrl}</a></div>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:9}}>
        <button type="button" style={secondaryButton} onClick={()=>navigator.clipboard?.writeText(business.public_id)}>Copy Shop ID</button>
        <button type="button" style={secondaryButton} onClick={()=>navigator.clipboard?.writeText(shopUrl)}>Copy shop link</button>
        <a href={'https://wa.me/?text='+encodeURIComponent('Find my shop on DigiNanba: '+shopUrl)} target="_blank" rel="noreferrer" style={{...primaryButton,textDecoration:'none'}}>Share on WhatsApp</a>
      </div>
      <form onSubmit={addProduct} style={{background:'#fff',border:'1px solid #e4e7ec',borderRadius:16,padding:16,display:'grid',gap:12}}>
        <h3 style={{margin:0,fontSize:19}}>Add your first product</h3>
        <label style={{display:'grid',gap:5,fontSize:14,fontWeight:650}}>Product name *
          <input required minLength={3} value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Ponni boiled rice" style={field}/>
        </label>
        <label style={{display:'grid',gap:5,fontSize:14,fontWeight:650}}>Product category *
          <select value={productCategory} onChange={e=>setProductCategory(e.target.value)} style={field}>
            {['Groceries & Daily Needs','Vegetables & Fruits','Medical Shops & Pharmacy','Food, Bakery & Sweets','Clothing & Footwear','Mobile & Electronics','Electrical & Hardware','Home & Kitchen','Building Materials','Vehicle Spares','Stationery & Books','Beauty & Personal Care','Agriculture & Garden','Pet Supplies','Other'].map(x=><option key={x}>{x}</option>)}
          </select>
        </label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <label style={{display:'grid',gap:5,fontSize:14}}>Price ({currency})
            <input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Optional" style={field}/>
          </label>
          <label style={{display:'grid',gap:5,fontSize:14}}>Unit
            <select value={unit} onChange={e=>setUnit(e.target.value)} style={field}>{['piece','kg','g','litre','ml','packet','box','dozen','pack'].map(x=><option key={x}>{x}</option>)}</select>
          </label>
        </div>
        <button disabled={busy} type="submit" style={primaryButton}>{busy?'Saving…':'Add Product to My Shop'}</button>
      </form>
      {notice?<p role="status" style={{margin:0,color:'#344054'}}>{notice}</p>:null}
    </section>}
    {invitationCode?<p style={{fontSize:11,color:'#98a2b3',textAlign:'center'}}>Invitation reference received. The customer who invited you is not shown publicly.</p>:null}
  </main>;
}

const field:CSSProperties={width:'100%',boxSizing:'border-box',padding:'12px 13px',border:'1px solid #d0d5dd',borderRadius:10,font:'inherit',background:'#fff',color:'#172033'};
const primaryButton:React.CSSProperties={border:0,borderRadius:999,padding:'12px 18px',background:'#176b4d',color:'#fff',fontWeight:750,cursor:'pointer',textAlign:'center'};
const secondaryButton:React.CSSProperties={border:'1px solid #d0d5dd',borderRadius:999,padding:'11px 16px',background:'#fff',color:'#344054',fontWeight:650,cursor:'pointer'};
