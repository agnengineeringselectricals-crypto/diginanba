import Link from 'next/link';
import {getProducts} from '@/lib/catalog';
import type {Market} from '@/lib/market';
export default async function Explore({searchParams}:{searchParams:Promise<{q?:string;market?:string}>}){
 const p=await searchParams; const market=(p.market==='UK'?'UK':'US') as Market; const products=await getProducts(market,p.q||'');
 return <main className="wrap catalog-page"><div className="sectionhead"><div><div className="eyebrow">Marketplace</div><h1>Explore digital products</h1><p className="muted">Practical resources for work, business, learning and life.</p></div><Link className="btn" href="/">← Home</Link></div><form className="catalog-search"><input name="q" defaultValue={p.q||''} placeholder="Search products, skills or problems…"/><input type="hidden" name="market" value={market}/><button className="btn primary">Search</button></form><div className="catalog-grid">{products.map(x=><Link href={`/products/${x.slug}?market=${market}`} className="product-card" key={x.id}><span className="category">{x.category}</span><h2>{x.title}</h2><p className="muted">{x.description}</p><div className="product-foot"><b>{x.price}</b><span>View product →</span></div></Link>)}</div>{!products.length&&<div className="panel"><h2>No products found</h2><p className="muted">Try a different search.</p></div>}</main>
}
