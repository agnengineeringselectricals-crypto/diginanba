'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CatalogProduct } from '@/lib/catalog';
import type { Market } from '@/lib/market';

const categories = [
  ['📚', 'Ebooks & Guides', 'Ebooks & Guides'],
  ['📊', 'Excel / Google Sheets', 'Excel & Sheets'],
  ['📄', 'Templates & Documents', 'Templates & Documents'],
  ['🎨', 'Design Assets', 'Design Assets'],
  ['📣', 'Marketing & Sales', 'Marketing & Sales'],
  ['🤖', 'AI & Automation', 'AI & Automation'],
  ['🚀', 'Business & Entrepreneurship', 'Business & Entrepreneurship'],
  ['🎓', 'Education & Learning', 'Education & Learning'],
  ['💻', 'Software / Code', 'Software / Code'],
  ['📐', 'CAD / Engineering', 'CAD & Engineering'],
  ['💰', 'Finance & Accounting', 'Finance & Accounting'],
  ['💼', 'Career & Professional', 'Career & Professional'],
  ['🎥', 'Video / Audio', 'Video & Audio'],
  ['📷', 'Photography', 'Photography'],
  ['🖨️', 'Printables', 'Printables'],
  ['🌿', 'Personal / Lifestyle', 'Personal & Lifestyle'],
] as const;

const needs = [
  ['🚀', 'Start a business', 'Business & Entrepreneurship'],
  ['💰', 'Manage finances', 'Finance & Accounting'],
  ['📈', 'Grow sales', 'Marketing & Sales'],
  ['🎬', 'Create content', 'Video & Audio'],
  ['🎓', 'Learn a skill', 'Education & Learning'],
  ['💼', 'Get a job', 'Career & Professional'],
  ['🗂️', 'Manage projects', 'Templates & Documents'],
  ['⚙️', 'Automate work', 'AI & Automation'],
  ['🎨', 'Design something', 'Design Assets'],
  ['💻', 'Build an app', 'Software / Code'],
] as const;

const categoryMatches: Record<string, string[]> = {
  'Ebooks & Guides': ['Ebooks & Guides'],
  'Excel / Google Sheets': ['Excel / Google Sheets', 'Excel & Sheets'],
  'Templates & Documents': ['Templates & Documents'],
  'Design Assets': ['Design Assets'],
  'Marketing & Sales': ['Marketing & Sales'],
  'AI & Automation': ['AI & Automation'],
  'Business & Entrepreneurship': ['Business & Entrepreneurship'],
  'Education & Learning': ['Education & Learning'],
  'Software / Code': ['Software / Code'],
  'CAD / Engineering': ['CAD / Engineering', 'CAD & Engineering'],
  'Finance & Accounting': ['Finance & Accounting'],
  'Career & Professional': ['Career & Professional'],
  'Video / Audio': ['Video / Audio', 'Video & Audio'],
  Photography: ['Photography'],
  Printables: ['Printables'],
  'Personal / Lifestyle': ['Personal / Lifestyle', 'Personal & Lifestyle'],
};

type Props = { initialProducts: CatalogProduct[] };

export default function HomePageClient({ initialProducts }: Props) {
  const [market, setMarket] = useState<Market>('US');
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [heroQuery, setHeroQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');
  const [marketOpen, setMarketOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let selected = localStorage.getItem('diginanba-market') as Market | null;
    if (selected !== 'US' && selected !== 'UK') {
      const language = (navigator.language || '').toLowerCase();
      const timezone = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
      selected = language.endsWith('-gb') || timezone.includes('london') ? 'UK' : 'US';
    }
    setMarket(selected);
    try {
      const cart = JSON.parse(localStorage.getItem('diginanba-cart') || '[]');
      setCartCount(Array.isArray(cart) ? cart.length : 0);
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products?market=${market}`)
      .then((response) => response.json())
      .then((data: { products?: CatalogProduct[] }) => {
        if (!cancelled && Array.isArray(data.products)) setProducts(data.products);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [market]);

  const currency = market === 'UK' ? 'GBP' : 'USD';
  const marketName = market === 'UK' ? 'United Kingdom' : 'United States';
  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const allowed = category === 'All' ? null : categoryMatches[category] ?? [category];
    const result = products.filter((product) =>
      (!term || `${product.title} ${product.category} ${product.description}`.toLowerCase().includes(term)) &&
      (!allowed || allowed.includes(product.category))
    );
    if (sort === 'low') result.sort((a, b) => a.amountMinor - b.amountMinor);
    if (sort === 'high') result.sort((a, b) => b.amountMinor - a.amountMinor);
    return result;
  }, [category, products, query, sort]);

  function chooseCategory(value: string) {
    setCategory(value);
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
  }

  function chooseNeed(value: string) {
    setQuery('');
    setHeroQuery('');
    chooseCategory(value);
  }

  function runSearch(event?: React.FormEvent) {
    event?.preventDefault();
    setQuery(heroQuery);
    setCategory('All');
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
  }

  function setSelectedMarket(value: Market) {
    setMarket(value);
    localStorage.setItem('diginanba-market', value);
    setMarketOpen(false);
  }

  function addProductToCart(product: CatalogProduct) {
    try {
      const saved = JSON.parse(localStorage.getItem('diginanba-cart') || '[]');
      const items = Array.isArray(saved) ? saved.filter((item: { slug?: string }) => item.slug !== product.slug) : [];
      localStorage.setItem('diginanba-cart', JSON.stringify([...items, {
        slug: product.slug, title: product.title, price: product.price,
        amountMinor: product.amountMinor, market,
      }]));
      setCartCount(items.length + 1);
    } catch {
      window.alert('Unable to add this product to the cart. Please try again.');
    }
  }

  return <>
    <header className="ref-header">
      <div className="ref-container ref-nav">
        <Link href="/" className="ref-logo"><span>Digi</span>Nanba</Link>
        <nav className="ref-links" aria-label="Main navigation">
          <a href="#home">Home</a><a href="#explore">Explore</a><a href="#categories">Categories</a><a href="#needs">What do you need?</a>
        </nav>
        <div className="ref-actions">
          <button className="ref-market" onClick={() => setMarketOpen(true)}>{market === 'UK' ? '🇬🇧 UK · GBP' : '🇺🇸 US · USD'}</button>
          <Link className="ref-ghost" href="/login">Log in</Link>
          <Link className="ref-primary" href="/signup">Sign up</Link>
          <Link className="ref-ghost ref-cart" href="/cart" aria-label={`Cart, ${cartCount} items`}>🛒<span className="ref-count">{cartCount}</span></Link>
        </div>
      </div>
    </header>

    <main id="home">
      <section className="ref-hero">
        <div className="ref-container ref-hero-grid">
          <div>
            <span className="ref-eyebrow">DIGITAL PRODUCTS FOR EVERYDAY WORK</span>
            <h1>Find the digital tools that solve your problem.</h1>
            <p>Discover ready-to-use templates, guides, spreadsheets, design assets, automation tools, learning resources and more — localized for your market.</p>
            <form className="ref-searchbox" onSubmit={runSearch}>
              <input value={heroQuery} onChange={(event) => setHeroQuery(event.target.value)} placeholder="Search for a product, skill, problem or goal…" aria-label="Search products" />
              <button className="ref-primary" type="submit">Search</button>
            </form>
          </div>
          <div className="ref-hero-card">
            <h3>Popular in the {marketName}</h3>
            <div className="ref-mini"><div className="ref-icon">📊</div><div><b>Business &amp; Finance</b><br /><small>Templates that save time</small></div></div>
            <div className="ref-mini"><div className="ref-icon">🤖</div><div><b>AI &amp; Automation</b><br /><small>Workflows and productivity tools</small></div></div>
            <div className="ref-mini"><div className="ref-icon">📚</div><div><b>Guides &amp; Learning</b><br /><small>Learn faster with practical resources</small></div></div>
            <div className="ref-mini"><div className="ref-icon">🎨</div><div><b>Creative Assets</b><br /><small>Design, content and media kits</small></div></div>
          </div>
        </div>
      </section>

      <section id="needs" className="ref-section"><div className="ref-container">
        <div className="ref-section-head"><div><h2>What are you trying to do?</h2><p>Start with your goal instead of searching through hundreds of products.</p></div></div>
        <div className="ref-needs">{needs.map(([icon, label, target]) => <button className="ref-need" key={label} onClick={() => chooseNeed(target)}>{icon} {label}</button>)}</div>
      </div></section>

      <section id="categories" className="ref-section"><div className="ref-container">
        <div className="ref-section-head"><div><h2>Shop by category</h2><p>A broad marketplace taxonomy for practical digital products.</p></div></div>
        <div className="ref-categories">{categories.map(([icon, label]) => <button className="ref-category" key={label} onClick={() => chooseCategory(label)}><span className="ref-category-icon">{icon}</span><span><strong>{label}</strong><small>Explore products</small></span></button>)}</div>
      </div></section>

      <section id="explore" className="ref-section"><div className="ref-container">
        <div className="ref-section-head"><div><h2>Explore digital products</h2><p>{visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'} available for {marketName} · {currency}</p></div></div>
        <div className="ref-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" aria-label="Filter products" />
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="All">All categories</option>{categories.map(([, label]) => <option value={label} key={label}>{label}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
        </div>
        {visibleProducts.length ? <div className="ref-products">{visibleProducts.map((product) => <article className="ref-product" key={product.id}>
          <Link className="ref-product-art" href={`/products/${product.slug}?market=${market}`} aria-label={`View ${product.title}`}>{categories.find(([, , dbName]) => dbName === product.category)?.[0] ?? '✦'}</Link>
          <div className="ref-product-body"><span className="ref-tag">{product.category}</span><h3><Link href={`/products/${product.slug}?market=${market}`}>{product.title}</Link></h3><p>{product.description}</p><div className="ref-price-row"><span className="ref-price">{product.price}</span><Link className="ref-view-product" href={`/products/${product.slug}?market=${market}`}>View product</Link></div><button className="ref-add-cart" onClick={() => addProductToCart(product)}>Add to cart</button></div>
        </article>)}</div> : <div className="ref-empty">No products found for this category or search. Try another search or category.</div>}
      </div></section>

      <section className="ref-section"><div className="ref-container"><div className="ref-banner"><div><h2>Ready-to-use. Localized. Download instantly.</h2><p>Your selected market controls currency, formatting and product edition.</p></div><a className="ref-primary" href="#explore">Explore products</a></div></div></section>
    </main>

    <footer className="ref-footer"><div className="ref-container ref-footer-grid">
      <div><h3>DigiNanba</h3><p>A global marketplace for practical digital products.</p><div className="ref-note">Checkout requires sign-in. Payments remain in demo mode until a provider is configured.</div></div>
      <div><h4>Marketplace</h4><a href="#explore">Explore</a><a href="#categories">Categories</a><a href="#needs">What do you need?</a></div>
      <div><h4>Account</h4><Link href="/login">Log in</Link><Link href="/signup">Create account</Link><Link href="/cart">Cart</Link></div>
      <div><h4>For creators</h4><Link href="/signup">Become a seller</Link><a href="#explore">Seller resources</a><a href="#explore">Help center</a></div>
    </div></footer>

    {marketOpen && <div className="ref-modal-backdrop" onClick={() => setMarketOpen(false)}><div className="ref-modal" role="dialog" aria-modal="true" aria-labelledby="market-title" onClick={(event) => event.stopPropagation()}>
      <button className="ref-close" onClick={() => setMarketOpen(false)} aria-label="Close market selector">✕</button><h2 id="market-title">Choose your market</h2><p>Automatic detection selects a market. You can override it at any time.</p>
      <div className="ref-market-options"><button className={`ref-market-option ${market === 'US' ? 'active' : ''}`} onClick={() => setSelectedMarket('US')}>🇺🇸 <b>United States</b><br /><small>USD · US-localized product editions</small></button><button className={`ref-market-option ${market === 'UK' ? 'active' : ''}`} onClick={() => setSelectedMarket('UK')}>🇬🇧 <b>United Kingdom</b><br /><small>GBP · UK-localized product editions</small></button></div>
    </div></div>}
  </>;
}
