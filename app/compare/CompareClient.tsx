'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Product = { slug: string; title: string; description: string; category: string; price: string; market: 'US' | 'UK' | 'IN' };

export default function CompareClient({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('diginanba-compare') || '[]');
      setSelected(Array.isArray(stored) ? stored.filter((slug: string) => products.some((product) => product.slug === slug)).slice(0, 4) : []);
    } catch {
      setSelected([]);
    }
    setReady(true);
  }, [products]);

  function remove(slug: string) {
    const next = selected.filter((item) => item !== slug);
    setSelected(next);
    localStorage.setItem('diginanba-compare', JSON.stringify(next));
  }

  const compared = products.filter((product) => selected.includes(product.slug));

  return (
    <main className="wrap">
      <div className="page-head">
        <div>
          <div className="eyebrow">SHOP SMARTER</div>
          <h1>Compare digital products</h1>
          <p className="muted">Compare descriptions, categories and displayed prices side by side before choosing.</p>
        </div>
        <Link className="btn" href="/explore">Browse products</Link>
      </div>
      {!ready ? <div className="panel">Loading comparison…</div> : compared.length < 2 ? (
        <div className="panel">
          <h2>Select at least two products</h2>
          <p className="muted">Open a product page and choose “Add to compare”. You can compare up to four products.</p>
          <div className="product-list-grid">
            {products.map((product) => (
              <article className="panel" key={product.slug}>
                <span className="category">{product.category}</span>
                <h3>{product.title}</h3>
                <strong>{product.price}</strong>
                <div className="button-row">
                  <Link className="btn" href={'/products/' + product.slug}>View product</Link>
                  <button className="btn" disabled={selected.length >= 4 && !selected.includes(product.slug)} onClick={() => {
                    const next = selected.includes(product.slug) ? selected : [...selected, product.slug].slice(-4);
                    setSelected(next);
                    localStorage.setItem('diginanba-compare', JSON.stringify(next));
                  }}>{selected.includes(product.slug) ? 'Selected' : 'Add to compare'}</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="button-row">
            {compared.map((product) => <button className="btn" key={product.slug} onClick={() => remove(product.slug)}>Remove {product.title}</button>)}
          </div>
          <div className="panel" style={{ overflowX: 'auto', marginTop: 16 }}>
            <table>
              <thead><tr><th>Feature</th>{compared.map((product) => <th key={product.slug}>{product.title}</th>)}</tr></thead>
              <tbody>
                <tr><th>Category</th>{compared.map((product) => <td key={product.slug}>{product.category}</td>)}</tr>
                <tr><th>Displayed price</th>{compared.map((product) => <td key={product.slug}><strong>{product.price}</strong></td>)}</tr>
                <tr><th>Description</th>{compared.map((product) => <td key={product.slug}>{product.description}</td>)}</tr>
                <tr><th>Product page</th>{compared.map((product) => <td key={product.slug}><Link href={'/products/' + product.slug}>View details →</Link></td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="muted">Comparison is based on the current US catalog and displayed product information.</p>
        </>
      )}
    </main>
  );
}
