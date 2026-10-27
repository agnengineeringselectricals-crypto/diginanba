import Link from 'next/link';
import { getProducts } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import AddToCartButton from '@/app/products/[slug]/AddToCartButton';

const categories = [
  'All categories', 'Ebooks & Guides', 'Excel & Sheets', 'Templates & Documents',
  'Design Assets', 'Marketing & Sales', 'AI & Automation', 'Business & Entrepreneurship',
  'Education & Learning', 'Software / Code', 'CAD & Engineering', 'Finance & Accounting',
  'Career & Professional', 'Video & Audio', 'Photography', 'Printables', 'Personal & Lifestyle',
];

export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; market?: string; category?: string; sort?: string; maxPrice?: string }>;
}) {
  const p = await searchParams;
  const market = (p.market === 'UK' || p.market === 'IN' ? p.market : 'US') as Market;
  const allProducts = await getProducts(market, p.q || '');
  const category = p.category || 'All categories';
  const maxPrice = p.maxPrice === '10' || p.maxPrice === '25' || p.maxPrice === '50' ? Number(p.maxPrice) : 0;
  let products = allProducts.filter((product) => {
    const categoryMatch = category === 'All categories' || product.category === category ||
      (category === 'Excel & Sheets' && product.category === 'Excel / Google Sheets') ||
      (category === 'CAD & Engineering' && product.category === 'CAD / Engineering') ||
      (category === 'Video & Audio' && product.category === 'Video / Audio') ||
      (category === 'Personal & Lifestyle' && product.category === 'Personal / Lifestyle');
    const priceMatch = !maxPrice || product.amountMinor <= maxPrice * 100;
    return categoryMatch && priceMatch;
  });
  if (p.sort === 'price-low') products.sort((a, b) => a.amountMinor - b.amountMinor);
  else if (p.sort === 'price-high') products.sort((a, b) => b.amountMinor - a.amountMinor);
  else if (p.sort === 'title') products.sort((a, b) => a.title.localeCompare(b.title));

  function filterUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    params.set('market', market);
    if (p.q) params.set('q', p.q);
    if (category !== 'All categories') params.set('category', category);
    if (p.sort) params.set('sort', p.sort);
    if (maxPrice) params.set('maxPrice', String(maxPrice));
    for (const [key, value] of Object.entries(overrides)) {
      if (!value || (key === 'category' && value === 'All categories')) params.delete(key);
      else params.set(key, value);
    }
    return '/explore?' + params.toString();
  }

  return (
    <main className="wrap catalog-page">
      <div className="page-head">
        <div><div className="eyebrow">DIGITAL MARKETPLACE</div><h1>Explore digital products</h1><p className="muted">Find the right tool for your work, goals and everyday needs.</p></div>
        <div className="button-row"><Link className="btn" href="/solutions">Shop by goal</Link><Link className="btn" href="/">Home</Link></div>
      </div>

      <form className="catalog-search" action="/explore">
        <input name="q" defaultValue={p.q || ''} placeholder="Search products, skills or problems…" aria-label="Search products" />
        <input type="hidden" name="market" value={market} />
        {category !== 'All categories' && <input type="hidden" name="category" value={category} />}
        {p.sort && <input type="hidden" name="sort" value={p.sort} />}
        {maxPrice > 0 && <input type="hidden" name="maxPrice" value={String(maxPrice)} />}
        <button className="btn primary" type="submit">Search</button>
      </form>

      <form className="panel dn-filter-panel" action="/explore">
        <input type="hidden" name="market" value={market} />
        {p.q && <input type="hidden" name="q" value={p.q} />}
        <div className="dn-filter-heading"><div><h2>Find your best fit</h2><p className="muted">Narrow the results by category, budget or price order.</p></div><Link className="btn" href={'/explore?market=' + market}>Reset filters</Link></div>
        <div className="dn-filter-controls">
          <label>Category<select name="category" defaultValue={category}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Budget<select name="maxPrice" defaultValue={maxPrice ? String(maxPrice) : ''}><option value="">Any price</option><option value="10">Up to {market === 'IN' ? '₹' : market === 'UK' ? '£' : '$'}10</option><option value="25">Up to {market === 'IN' ? '₹' : market === 'UK' ? '£' : '$'}25</option><option value="50">Up to {market === 'IN' ? '₹' : market === 'UK' ? '£' : '$'}50</option></select></label>
          <label>Sort by<select name="sort" defaultValue={p.sort || 'featured'}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="title">Name: A to Z</option></select></label>
          <button className="btn primary" type="submit">Apply filters</button>
        </div>
      </form>

      <div className="quick-links" aria-label="Browse categories">
        {categories.slice(1).map((label) => <Link key={label} href={filterUrl({ category: label })}>{label}</Link>)}
      </div>

      <div className="catalog-result-summary"><p className="muted" aria-live="polite"><strong>{products.length}</strong> {products.length === 1 ? 'product' : 'products'} found{p.q ? ` for “${p.q}”` : ''}{category !== 'All categories' ? ` in ${category}` : ''}.</p>{p.q ? <Link className="btn" href={'/explore?market=' + market}>Clear search</Link> : null}</div>

      <div className="catalog-grid">
        {products.map((x) => <article className="product-card dn-compact-product-card" key={x.id}><Link href={'/products/' + x.slug + '?market=' + market} className="dn-compact-product-title"><h2>{x.title}</h2></Link>{x.creatorName && x.creatorName.trim().toLowerCase() !== 'diginanba' && <small className="dn-compact-creator" title={x.creatorName}>by {x.creatorName.trim().split(/\s+/).slice(0, 2).join(' ')}</small>}<div className="product-foot"><b>{x.price}</b><AddToCartButton product={{slug:x.slug,title:x.title,price:x.price,amountMinor:x.amountMinor,market}} /></div></article>)}
      </div>

      {!products.length && <div className="panel dn-empty-state"><div aria-hidden="true">🔎</div><h2>No exact matches yet</h2><p className="muted">Try a broader search, increase your budget, or choose another category. Your searches help DigiNanba understand what products people need.</p><div className="button-row"><Link href={'/explore?market=' + market} className="btn">Clear filters</Link><Link href="/solutions" className="btn primary">Find a solution</Link></div></div>}
      <style>{`
        .dn-compact-product-card{min-height:0;padding:13px 14px;border-radius:12px;gap:6px;justify-content:space-between}
        .dn-compact-product-title{display:block;min-width:0}
        .dn-compact-product-title h2{font-size:14px;line-height:1.3;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .dn-compact-creator{font-size:11px;color:#687080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dn-compact-product-card .product-foot{padding-top:8px;gap:8px}
        .dn-compact-product-card .product-foot b{font-size:16px}
        .dn-compact-product-card .product-foot .btn{padding:7px 9px;font-size:11px;white-space:nowrap}
        .dn-filter-panel{margin:18px 0;padding:20px}
        .dn-filter-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
        .dn-filter-heading h2{font-size:18px;margin:0 0 5px}
        .dn-filter-heading p{font-size:13px;margin:0}
        .dn-filter-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;align-items:end;gap:12px}
        .dn-filter-controls label{display:grid;gap:7px;font-size:12px;font-weight:700}
        .dn-filter-controls select{width:100%;min-width:0;padding:11px;border:1px solid var(--border,#dfe3ed);border-radius:10px;background:var(--surface,#fff);color:inherit;font:inherit}
        .dn-empty-state{text-align:center;padding:36px 20px;margin-top:20px}
        .dn-empty-state>div:first-child{font-size:34px}
        .dn-empty-state h2{margin:10px 0}
        .dn-empty-state .button-row{justify-content:center;margin-top:18px}
        @media(max-width:760px){.dn-filter-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.dn-filter-heading{align-items:flex-start}}
        @media(max-width:480px){.dn-filter-controls{grid-template-columns:1fr}.dn-filter-heading{flex-direction:column}.dn-filter-controls button{width:100%}}
      `}</style>
    </main>
  );
}
