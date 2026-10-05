'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CatalogProduct } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import type { DiscoveryCategory, DiscoveryNeed, DiscoveryRow } from '@/lib/discovery';

type Props = {
  initialProducts: CatalogProduct[];
  categories: DiscoveryCategory[];
  needs: DiscoveryNeed[];
  rows: DiscoveryRow[];
};

function normalizeWord(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(ing|ers|ies|ed|es|s)$/u, (suffix) => suffix === 'ies' ? 'y' : '');
}

export default function HomePageClient({ initialProducts, categories, needs, rows }: Props) {
  const [market, setMarket] = useState<Market>('US');
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [needFilter, setNeedFilter] = useState<string[]>([]);
  const [activeNeed, setActiveNeed] = useState('');
  const [sort, setSort] = useState('featured');
  const [marketOpen, setMarketOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    } catch { setCartCount(0); }
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

  const visibleProducts = useMemo(() => {
    const tokens = query.trim().split(/\s+/u).filter(Boolean).map(normalizeWord).filter((token) => token.length > 1);
    const filtered = products.flatMap((product) => {
      const searchable = `${product.title} ${product.category} ${product.description}`.toLowerCase();
      const words = searchable.split(/[^a-z0-9]+/u).filter(Boolean).map(normalizeWord);
      const metadata = categories.find((item) => item.matches.includes(product.category))?.searchTerms ?? [];
      const score = tokens.reduce((total, token) => {
        if (normalizeWord(product.title).includes(token)) return total + 5;
        if (normalizeWord(product.category).includes(token)) return total + 3;
        if (metadata.some((term) => normalizeWord(term).includes(token))) return total + 2;
        return total + (words.includes(token) ? 1 : 0);
      }, 0);
      const searchMatches = tokens.length === 0 || score > 0;
      const selectedCategory = categories.find((item) => item.name === category);
      const categoryMatches = category === 'All' || selectedCategory?.matches.includes(product.category);
      const needMatches = needFilter.length === 0 || needFilter.some((name) => {
        const selectedNeedCategory = categories.find((item) => item.name === name);
        return (selectedNeedCategory?.matches ?? [name]).includes(product.category);
      });
      return searchMatches && categoryMatches && needMatches ? [{ product, score }] : [];
    });
    if (sort === 'low') filtered.sort((a, b) => a.product.amountMinor - b.product.amountMinor);
    else if (sort === 'high') filtered.sort((a, b) => b.product.amountMinor - a.product.amountMinor);
    else if (tokens.length) filtered.sort((a, b) => b.score - a.score);
    return filtered.map(({ product }) => product);
  }, [categories, category, needFilter, products, query, sort]);
  const hasActiveFilters = Boolean(query.trim() || category !== 'All' || needFilter.length);

  function chooseCategory(value: string) {
    setCategory(value);
    setNeedFilter([]);
    setActiveNeed('');
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
  }

  function chooseNeed(need: DiscoveryNeed) {
    setQuery('');
    setCategory('All');
    setNeedFilter(need.categories);
    setActiveNeed(need.label);
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
  }

  function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategory('All');
    setNeedFilter([]);
    setActiveNeed('');
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
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
    } catch { window.alert('Unable to add this product to the cart. Please try again.'); }
  }

  function setSelectedMarket(value: Market) {
    setMarket(value);
    localStorage.setItem('diginanba-market', value);
    setMarketOpen(false);
  }

  function productIcon(product: CatalogProduct) {
    return categories.find((item) => item.matches.includes(product.category))?.icon ?? '✦';
  }

  function belongsToRow(product: CatalogProduct, row: DiscoveryRow) {
    return row.categories.some((name) => {
      const configuredCategory = categories.find((item) => item.name === name || item.matches.includes(name));
      return configuredCategory?.matches.includes(product.category) ?? name === product.category;
    });
  }

  function renderProductCard(product: CatalogProduct, shelf = false) {
    return <article className={`ref-product${shelf ? ' ref-shelf-card' : ''}`} key={`${shelf ? 'shelf-' : ''}${product.id}`}>
      <Link className="ref-product-art" href={`/products/${product.slug}?market=${market}`} aria-label={`View ${product.title}`}>{productIcon(product)}</Link>
      <div className="ref-product-body"><span className="ref-tag">{product.category}</span><h3><Link href={`/products/${product.slug}?market=${market}`}>{product.title}</Link></h3><p>{product.description}</p><div className="ref-price-row"><span className="ref-price">{product.price}</span><Link className="ref-view-product" href={`/products/${product.slug}?market=${market}`}>View product</Link></div><button className="ref-add-cart" onClick={() => addProductToCart(product)}>Add to cart</button></div>
    </article>;
  }

  return <>
    <header className="ref-header">
      <div className="ref-container ref-nav">
        <Link href="/" className="ref-logo"><span>Digi</span>Nanba</Link>
        <button className="ref-menu-toggle" onClick={() => setMobileNavOpen((open) => !open)} aria-expanded={mobileNavOpen} aria-controls="main-navigation">{mobileNavOpen ? 'Close' : 'Browse'}</button>
        <nav id="main-navigation" className={`ref-links ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="#home" onClick={() => setMobileNavOpen(false)}>Home</a>
          <a href="#explore" onClick={() => setMobileNavOpen(false)}>Explore</a>
          <details className="ref-category-menu"><summary>Categories</summary><div className="ref-category-dropdown">{categories.map((item) => <button key={item.name} onClick={(event) => { chooseCategory(item.name); setMobileNavOpen(false); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{item.icon} {item.name}</button>)}</div></details>
          <a href="#needs" onClick={() => setMobileNavOpen(false)}>What do you need?</a>
          <a className="ref-mobile-auth" href="/login">Log in</a>
          <a className="ref-mobile-auth" href="/signup">Create an account</a>
          <a className="ref-mobile-auth" href="/account">Your account and orders</a>
        </nav>
        <div className="ref-actions">
          <button className="ref-market" onClick={() => setMarketOpen(true)} aria-label="Choose market and currency">{market === 'UK' ? '🇬🇧 GBP' : '🇺🇸 USD'}</button>
          <Link className="ref-ghost ref-login" href="/login">Log in</Link>
          <Link className="ref-primary ref-signup" href="/signup">Sign up</Link>
          <Link className="ref-ghost ref-orders" href="/account">Orders</Link>
          <Link className="ref-ghost ref-cart" href="/cart" aria-label={`Cart, ${cartCount} items`}>🛒<span className="ref-count">{cartCount}</span></Link>
        </div>
      </div>
    </header>

    <nav className="ref-marketplace-nav" aria-label="Browse product categories"><div className="ref-container ref-marketplace-nav-inner">
      <button className={category === 'All' ? 'active' : ''} onClick={() => chooseCategory('All')}>All products</button>
      {categories.map((item) => <button className={category === item.name ? 'active' : ''} key={item.name} onClick={() => chooseCategory(item.name)}>{item.name}</button>)}
    </div></nav>

    <main id="home">
      <section className="ref-hero"><div className="ref-container ref-hero-layout">
        <div className="ref-hero-content">
          <span className="ref-eyebrow">DIGITAL PRODUCTS FOR WORK, LEARNING &amp; LIFE</span>
          <h1>Find the right digital product for what you want to do.</h1>
          <p>Learn something new, solve a work challenge, or bring your next idea to life.</p>
          <form className="ref-searchbox" onSubmit={runSearch} role="search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses, guides, templates, spreadsheets and more" aria-label="Search digital products" />
            <button className="ref-primary" type="submit">Search</button>
          </form>
        </div>
        {initialProducts[0] && <aside className="ref-hero-spotlight" aria-label="A product to explore">
          <div className="ref-spotlight-art">{productIcon(initialProducts[0])}</div>
          <div className="ref-spotlight-content"><span className="ref-kicker">A PLACE TO START</span><span className="ref-tag">{initialProducts[0].category}</span><h2>{initialProducts[0].title}</h2><p>{initialProducts[0].description}</p><div><strong>{initialProducts[0].price}</strong><Link href={`/products/${initialProducts[0].slug}?market=${market}`}>View product →</Link></div></div>
        </aside>}
      </div></section>

      <section id="explore" className="ref-section ref-explore"><div className="ref-container">
        {hasActiveFilters ? <>
          <div className="ref-section-head"><div><span className="ref-kicker">PRODUCT RESULTS</span><h2>Explore digital products</h2></div><button className="ref-clear-filters" onClick={() => { setQuery(''); setCategory('All'); setNeedFilter([]); setActiveNeed(''); }}>Clear filters</button></div>
          <div className="ref-toolbar"><label className="ref-filter-label">Category<select value={category} onChange={(event) => { setCategory(event.target.value); setNeedFilter([]); setActiveNeed(''); }} aria-label="Filter by category"><option value="All">All categories</option>{categories.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label><label className="ref-filter-label">Sort by<select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label></div>
          {activeNeed && <p className="ref-active-filter">Showing products to help you: <strong>{activeNeed}</strong></p>}
          {visibleProducts.length ? <div className="ref-products">{visibleProducts.map((product) => renderProductCard(product))}</div> : <div className="ref-empty"><h3>No products match that search yet.</h3><p>Try another phrase or browse all products.</p><button className="ref-view-product" onClick={() => { setQuery(''); setCategory('All'); setNeedFilter([]); setActiveNeed(''); }}>Show all products</button></div>}
        </> : <div className="ref-shelves">{rows.map((row) => {
          const shelfProducts = products.filter((product) => belongsToRow(product, row));
          if (!shelfProducts.length) return null;
          return <section className="ref-shelf" key={row.key} aria-labelledby={`shelf-${row.key}`}>
            <div className="ref-shelf-heading"><div><h2 id={`shelf-${row.key}`}>{row.title}</h2><p>{row.subtitle}</p></div><Link href="/explore">See all products →</Link></div>
            <div className="ref-shelf-track">{shelfProducts.map((product) => renderProductCard(product, true))}</div>
          </section>;
        })}</div>}
      </div></section>

      <section id="needs" className="ref-section ref-needs-section"><div className="ref-container">
        <details className="ref-needs-disclosure"><summary><span><span className="ref-kicker">EXPLORE BY GOAL</span><strong>What are you trying to do?</strong><small>Choose a goal to find useful products.</small></span><span className="ref-disclosure-icon" aria-hidden="true">＋</span></summary>
          <div className="ref-needs">{needs.map((need) => <button className="ref-need" key={need.label} onClick={() => chooseNeed(need)}><span>{need.icon}</span>{need.label}<span aria-hidden="true">→</span></button>)}</div>
        </details>
      </div></section>

      <section className="ref-section ref-topic-section"><div className="ref-container"><div className="ref-topic-panel"><div><span className="ref-kicker">KEEP EXPLORING</span><h2>Find a resource for your next idea.</h2><p>Browse practical learning and productivity products made to help you move forward.</p></div><Link className="ref-primary" href="/explore">Explore the marketplace</Link></div></div></section>
    </main>

    <footer className="ref-footer"><div className="ref-container ref-footer-grid">
      <div className="ref-footer-brand"><h3><span>Digi</span>Nanba</h3><p>A global marketplace for practical digital products.</p><div className="ref-note">Checkout requires sign-in. Payments remain in demo mode until a provider is configured.</div></div>
      <div><h4>Marketplace</h4><a href="#explore">Explore</a><a href="#needs">Browse by goal</a><Link href="/explore">All products</Link></div>
      <div><h4>For customers</h4><Link href="/account">My account</Link><Link href="/cart">Cart</Link><Link href="/login">Sign in</Link></div>
      <div><h4>For creators</h4><Link href="/signup">Become a seller</Link><a href="#explore">Creator resources</a></div>
    </div><div className="ref-container ref-footer-bottom"><span>© {new Date().getFullYear()} DigiNanba</span><span>Digital products for everyday progress.</span></div></footer>

    {marketOpen && <div className="ref-modal-backdrop" onClick={() => setMarketOpen(false)}><div className="ref-modal" role="dialog" aria-modal="true" aria-labelledby="market-title" onClick={(event) => event.stopPropagation()}>
      <button className="ref-close" onClick={() => setMarketOpen(false)} aria-label="Close market selector">✕</button><h2 id="market-title">Choose your market</h2><p>Prices are shown in the currency for your selected market.</p>
      <div className="ref-market-options"><button className={`ref-market-option ${market === 'US' ? 'active' : ''}`} onClick={() => setSelectedMarket('US')}>🇺🇸 <b>United States</b><br /><small>USD</small></button><button className={`ref-market-option ${market === 'UK' ? 'active' : ''}`} onClick={() => setSelectedMarket('UK')}>🇬🇧 <b>United Kingdom</b><br /><small>GBP</small></button></div>
    </div></div>}
  </>;
}
