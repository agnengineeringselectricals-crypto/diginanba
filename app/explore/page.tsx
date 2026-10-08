import Link from 'next/link';
import { getProducts } from '@/lib/catalog';
import type { Market } from '@/lib/market';

export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; market?: string }>;
}) {
  const p = await searchParams;
  const market = (p.market === 'UK' ? 'UK' : 'US') as Market;
  const products = await getProducts(market, p.q || '');

  return (
    <main className="wrap catalog-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">DIGITAL MARKETPLACE</div>
          <h1>Explore digital products</h1>
          <p className="muted">Search by product, skill, problem or goal.</p>
        </div>
        <div className="button-row">
          <Link className="btn" href="/solutions">Shop by goal</Link>
          <Link className="btn" href="/">Home</Link>
        </div>
      </div>

      <form className="catalog-search">
        <input name="q" defaultValue={p.q || ''} placeholder="Search products, skills or problems…" />
        <input type="hidden" name="market" value={market} />
        <button className="btn primary" type="submit">Search</button>
      </form>

      <div className="quick-links">
        <Link href="/explore?q=AI">AI &amp; Automation</Link>
        <Link href="/explore?q=business">Business</Link>
        <Link href="/explore?q=template">Templates</Link>
        <Link href="/explore?q=finance">Finance</Link>
        <Link href="/explore?q=career">Career</Link>
      </div>

      <div className="catalog-grid">
        {products.map((x) => (
          <Link href={'/products/' + x.slug + '?market=' + market} className="product-card" key={x.id}>
            <span className="category">{x.category}</span>
            <h2>{x.title}</h2>
            <p className="muted">{x.description}</p>
            <div className="product-foot">
              <b>{x.price}</b>
              <span>View product →</span>
            </div>
          </Link>
        ))}
      </div>

      {!products.length && (
        <div className="panel">
          <h2>No products found</h2>
          <p className="muted">Try a broader search or shop by goal.</p>
          <Link href="/solutions" className="btn primary">Find a solution</Link>
        </div>
      )}
    </main>
  );
}
