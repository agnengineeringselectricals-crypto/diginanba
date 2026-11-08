import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import SaveRegularShopButton from './SaveRegularShopButton';

export const runtime = 'nodejs';

export default async function ShopPublicPage({ params }: { params: Promise<{ publicId:string }> }) {
  const {publicId}=await params;
  const normalized=publicId.toUpperCase();
  const result=await db.query(
    `SELECT id,public_id,business_name,description,country_code,region_code,region,district,city,locality,address_line,verification_status,average_rating,rating_count
     FROM marketplace_businesses WHERE public_id=$1 AND business_type='shop' AND listing_status='published' LIMIT 1`,
    [normalized]
  );
  const shop=result.rows[0];
  if(!shop)notFound();
  const products=await db.query(
    `SELECT id,title,description,category,price_amount,currency,price_unit,availability_status
     FROM marketplace_listings WHERE business_id=$1 AND listing_status='published' ORDER BY created_at DESC LIMIT 100`,
    [shop.id]
  );
  const url='https://www.diginanba.com/s/'+shop.public_id;
  return <main style={{maxWidth:1000,margin:'0 auto',padding:'36px 20px 72px',color:'#172033'}}>
    <a href="/shops" style={{color:'#2454c6',textDecoration:'none',fontSize:13}}>← Back to My Shops</a>
    <section style={{marginTop:18,border:'1px solid #e4e7ec',borderRadius:20,padding:24,background:'#fff'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:240}}>
          <div style={{fontSize:12,fontWeight:800,color:'#5264b5',letterSpacing:'.08em'}}>DIGINANBA SHOP</div>
          <h1 style={{fontSize:'clamp(28px,5vw,40px)',margin:'8px 0'}}>{shop.business_name}</h1>
          <div style={{fontSize:14,color:'#667085'}}>{[shop.locality,shop.city,shop.region].filter(Boolean).join(' · ')}</div>
          <div style={{fontWeight:800,letterSpacing:1.5,fontSize:19,marginTop:12}}>{shop.public_id}</div>
          <div style={{marginTop:8,color:'#a66b12'}}>{shop.average_rating!=null?'★ '+Number(shop.average_rating).toFixed(1)+' ('+shop.rating_count+' ratings)':'No ratings yet'}</div>
          <div style={{fontSize:12,color:shop.verification_status==='verified'?'#027a48':'#667085',marginTop:8}}>{shop.verification_status==='verified'?'✓ Verified shop':'New on DigiNanba · Verification not yet completed'}</div>
          {shop.description?<p style={{lineHeight:1.6,color:'#475467'}}>{shop.description}</p>:null}
          <SaveRegularShopButton publicId={shop.public_id}/>
        </div>
        <div style={{width:180,textAlign:'center'}}>
          <img alt="Scan to open this DigiNanba shop" width="170" height="170" src={'https://api.qrserver.com/v1/create-qr-code/?size=170x170&data='+encodeURIComponent(url)} style={{padding:8,border:'1px solid #eaecf0',borderRadius:14}}/>
          <div style={{fontSize:12,color:'#667085',marginTop:5}}>Scan to view shop</div>
          <a href={'https://wa.me/?text='+encodeURIComponent('Find '+shop.business_name+' on DigiNanba: '+url)} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:12,color:'#176b4d',fontWeight:700}}>Share on WhatsApp</a>
        </div>
      </div>
    </section>
    <section style={{marginTop:28}}>
      <h2 style={{fontSize:23}}>Products from {shop.business_name}</h2>
      {products.rows.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:12}}>
        {products.rows.map((product:any)=><article key={product.id} style={{border:'1px solid #e4e7ec',borderRadius:14,padding:16}}>
          <h3 style={{fontSize:17,margin:'0 0 7px'}}>{product.title}</h3><div style={{fontSize:12,color:'#667085'}}>{product.category}</div>
          {product.description?<p style={{fontSize:13,color:'#475467'}}>{product.description}</p>:null}
          <div style={{fontWeight:750,marginTop:9}}>{product.price_amount!=null?(product.currency||'')+' '+Number(product.price_amount).toFixed(2)+(product.price_unit?' / '+product.price_unit:''):'Contact shop for price'}</div>
          <div style={{fontSize:12,color:'#667085',marginTop:5}}>{product.availability_status==='available'?'Available':product.availability_status==='unavailable'?'Currently unavailable':'Check availability'}</div>
        </article>)}
      </div>:<p style={{color:'#667085'}}>This shop has not added its products yet. Please check again later.</p>}
    </section>
  </main>;
}
