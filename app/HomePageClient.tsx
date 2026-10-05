'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogProduct } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import type { DiscoveryCategory, DiscoveryNeed, DiscoveryRow } from '@/lib/discovery';

const languagesByMarket: Record<Market, { code: string; label: string }[]> = {
  US: [{ code: 'en-US', label: 'English (US)' }],
  UK: [{ code: 'en-GB', label: 'English (UK)' }],
};

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
  const [language, setLanguage] = useState('en-US');
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [needFilter, setNeedFilter] = useState<string[]>([]);
  const [activeNeed, setActiveNeed] = useState('');
  const [sort, setSort] = useState('featured');
  const [marketOpen, setMarketOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const [canScrollCategories, setCanScrollCategories] = useState(false);
  const [categoryNavAtEnd, setCategoryNavAtEnd] = useState(false);

  useEffect(() => {
    let selected = localStorage.getItem('diginanba-market') as Market | null;
    if (selected !== 'US' && selected !== 'UK') {
      const language = (navigator.language || '').toLowerCase();
      const timezone = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
      selected = language.endsWith('-gb') || timezone.includes('london') ? 'UK' : 'US';
    }
    setMarket(selected);
    const availableLanguages = languagesByMarket[selected];
    const savedLanguage = localStorage.getItem('diginanba-language');
    setLanguage(availableLanguages.some((item) => item.code === savedLanguage) ? savedLanguage! : availableLanguages[0].code);
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

  useEffect(() => {
    const nav = categoryNavRef.current;
    if (!nav) return;
    const updateScrollState = () => {
      const maxScroll = nav.scrollWidth - nav.clientWidth;
      setCanScrollCategories(maxScroll > 2);
      setCategoryNavAtEnd(maxScroll <= 2 || nav.scrollLeft >= maxScroll - 2);
    };
    updateScrollState();
    nav.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      nav.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [categories]);

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
    const availableLanguages = languagesByMarket[value];
    if (!availableLanguages.some((item) => item.code === language)) {
      setLanguage(availableLanguages[0].code);
      localStorage.setItem('diginanba-language', availableLanguages[0].code);
    }
    setMarketOpen(false);
  }

  function setSelectedLanguage(value: string) {
    setLanguage(value);
    localStorage.setItem('diginanba-language', value);
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

  const marketFlag = market === 'UK' ? '🇬🇧' : '🇺🇸';

  function renderProductCard(product: CatalogProduct, shelf = false) {
    return <article className={`ref-product${shelf ? ' ref-shelf-card' : ''}`} key={`${shelf ? 'shelf-' : ''}${product.id}`}>
      <Link className="ref-product-art" href={`/products/${product.slug}?market=${market}`} aria-label={`View ${product.title}`}>{productIcon(product)}</Link>
      <div className="ref-product-body"><span className="ref-tag">{product.category}</span><h3><Link href={`/products/${product.slug}?market=${market}`}>{product.title}</Link></h3><p>{product.description}</p><div className="ref-price-row"><span className="ref-price">{product.price}</span><Link className="ref-view-product" href={`/products/${product.slug}?market=${market}`}>View product</Link></div><button className="ref-add-cart" onClick={() => addProductToCart(product)}>Add to cart</button></div>
    </article>;
  }

  return <>
    <header className="ref-header">
      <div className="ref-container ref-header-top">
        <Link href="/" className="ref-logo"><span>Digi</span>Nanba</Link>
        <form className="ref-market-search" onSubmit={runSearch} role="search">
          <label className="sr-only" htmlFor="market-search-category">Search category</label>
          <select id="market-search-category" value={category} onChange={(event) => chooseCategory(event.target.value)} aria-label="Choose search category"><option value="All">All</option>{categories.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select>
          <label className="sr-only" htmlFor="market-search-input">Search DigiNanba</label>
          <input id="market-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search DigiNanba" />
          <button type="submit" aria-label="Search DigiNanba"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></button>
        </form>
        <div className="ref-header-actions">
          <Link className="ref-header-account" href="/login">Sign in / Sign up</Link>
          <Link className="ref-header-cart" href="/cart" aria-label={`Cart, ${cartCount} items`}><span aria-hidden="true">🛒</span><strong>Cart</strong><span className="ref-count">{cartCount}</span></Link>
          <label className="ref-language-control"><span className="sr-only">Language</span><select value={language} onChange={(event) => setSelectedLanguage(event.target.value)} aria-label="Choose language">{languagesByMarket[market].map((item) => <option value={item.code} key={item.code}>EN</option>)}</select></label>
          <button className="ref-market-flag" onClick={() => setMarketOpen(true)} aria-label={`Selected market ${market === 'UK' ? 'United Kingdom' : 'United States'}; change country`} title={market === 'UK' ? 'United Kingdom' : 'United States'}>{marketFlag}</button>
        </div>
      </div>

      <nav className="ref-marketplace-nav" aria-label="Browse product categories"><div className="ref-container ref-marketplace-nav-shell">
        <div className="ref-marketplace-nav-inner" ref={categoryNavRef} role="group" aria-label="Product categories" tabIndex={0}>
          {categories.map((item) => <button className={category === item.name ? 'active' : ''} key={item.name} onClick={() => chooseCategory(item.name)} aria-pressed={category === item.name}>{item.icon} {item.name}</button>)}
        </div>
        {canScrollCategories && <button className="ref-category-scroll-arrow" type="button" onClick={() => categoryNavRef.current?.scrollBy({ left: Math.max(180, categoryNavRef.current.clientWidth * 0.7), behavior: 'smooth' })} disabled={categoryNavAtEnd} aria-label="Scroll categories right" title={categoryNavAtEnd ? 'End of categories' : 'Show more categories'}>→</button>}
      </div></nav>
    </header>

    <main id="home" className="ref-home">
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
        <div className="ref-needs-disclosure"><div className="ref-needs-heading"><span><span className="ref-kicker">EXPLORE BY GOAL</span><strong>What are you trying to do?</strong><small>Choose a goal to find useful products.</small></span></div>
          <div className="ref-needs">{needs.map((need) => <button className="ref-need" key={need.label} onClick={() => chooseNeed(need)}><span>{need.icon}</span>{need.label}<span aria-hidden="true">→</span></button>)}</div>
        </div>
      </div></section>

      <section className="ref-section ref-topic-section"><div className="ref-container"><div className="ref-topic-panel"><div><span className="ref-kicker">KEEP EXPLORING</span><h2>Find a resource for your next idea.</h2><p>Browse practical learning and productivity products made to help you move forward.</p></div><Link className="ref-primary" href="/explore">Explore the marketplace</Link></div></div></section>
    </main>

    <footer className="ref-footer">
      <a className="ref-back-top" href="#home">Back to top</a>
      <div className="ref-container ref-footer-grid">
        <div><h4>Get to Know DigiNanba</h4><a href="#home">About DigiNanba</a><a href="#explore">Explore the marketplace</a><a href="#needs">Browse by goal</a></div>
        <div><h4>Connect with Us</h4><Link href="/help">Help and support</Link><Link href="/signup">Create an account</Link><Link href="/login">Sign in</Link></div>
        <div><h4>Make Money with Us</h4><Link href="/signup">Become a seller</Link><Link href="/help#creators">Creator resources</Link></div>
        <div><h4>Refer &amp; Earn</h4><Link href="/refer">Referral program updates</Link></div>
        <div><h4>Let Us Help You</h4><Link href="/account">Your account</Link><Link href="/account">Orders and purchases</Link><Link href="/cart">Your cart</Link><Link href="/help">Help center</Link></div>
      </div>
      <div className="ref-footer-controls"><Link href="/" className="ref-logo"><span>Digi</span>Nanba</Link><label><span>Language</span><select value={language} onChange={(event) => setSelectedLanguage(event.target.value)} aria-label="Choose language">{languagesByMarket[market].map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}</select></label><button onClick={() => setMarketOpen(true)}><span>Country/region</span><strong>{market === 'UK' ? '🇬🇧 United Kingdom' : '🇺🇸 United States'}</strong></button></div>
      <div className="ref-footer-bottom"><span>© {new Date().getFullYear()} DigiNanba</span><span>Digital products for everyday progress.</span></div>
    </footer>

    {marketOpen && <div className="ref-modal-backdrop" onClick={() => setMarketOpen(false)}><div className="ref-modal" role="dialog" aria-modal="true" aria-labelledby="market-title" onClick={(event) => event.stopPropagation()}>
      <button className="ref-close" onClick={() => setMarketOpen(false)} aria-label="Close market selector">✕</button><h2 id="market-title">Choose your market</h2><p>Prices are shown in the currency for your selected market.</p>
      <div className="ref-market-options"><button className={`ref-market-option ${market === 'US' ? 'active' : ''}`} onClick={() => setSelectedMarket('US')}>🇺🇸 <b>United States</b><br /><small>USD</small></button><button className={`ref-market-option ${market === 'UK' ? 'active' : ''}`} onClick={() => setSelectedMarket('UK')}>🇬🇧 <b>United Kingdom</b><br /><small>GBP</small></button></div>
    </div></div>}
  </>;
}
