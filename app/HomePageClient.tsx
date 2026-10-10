'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CatalogProduct } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import CreatorEarningsShowcase from './CreatorEarningsShowcase';
import './creator-showcase.css';

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

const advancedSolutions = [
  ['⚙️', 'Automate end-to-end workflows', 'Connect repeatable tasks into a smarter AI-assisted process.', 'automate-work-with-ai'],
  ['📊', 'Build a cash-flow forecasting system', 'Plan runway, monitor margins and make better financial decisions.', 'manage-business-finances'],
  ['📈', 'Optimize your marketing funnel', 'Improve lead capture, campaign planning and conversion tracking.', 'grow-sales-and-marketing'],
  ['🗂️', 'Create a scalable project operating system', 'Coordinate milestones, resources, budgets and delivery in one workflow.', 'manage-projects'],
  ['🧩', 'Launch a digital product business', 'Organize your offer, operating plan and repeatable launch process.', 'start-a-small-business'],
  ['💻', 'Plan and validate a software product', 'Structure requirements, development tasks and launch preparation.', 'build-software'],
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
  const [languageOpen, setLanguageOpen] = useState(false);
  const [countryCode, setCountryCode] = useState('US');
  const [cartCount, setCartCount] = useState(0);
  const [languageCode, setLanguageCode] = useState('EN');
  const [countryFlag, setCountryFlag] = useState('🇺🇸');
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  useEffect(() => {
    let selected = localStorage.getItem('diginanba-market') as Market | null;
    if (selected !== 'US' && selected !== 'UK') {
      const language = (navigator.language || '').toLowerCase();
      const timezone = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
      selected = language.endsWith('-gb') || timezone.includes('london') ? 'UK' : 'US';
    }
    setMarket(selected);
    const language = (navigator.language || 'en-US').toLowerCase();
    const localeCountry = language.split('-')[1]?.toUpperCase() || (selected === 'UK' ? 'GB' : 'US');
    const languagePart = (language.split('-')[0] || 'en').toUpperCase().slice(0, 2);
    const flags: Record<string, string> = { US:'🇺🇸', GB:'🇬🇧', IN:'🇮🇳', CA:'🇨🇦', AU:'🇦🇺', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', IT:'🇮🇹', JP:'🇯🇵', CN:'🇨🇳', BR:'🇧🇷', AE:'🇦🇪', SG:'🇸🇬' };
    setCountryCode(localeCountry);
    setLanguageCode(languagePart);
    setSelectedLanguage(({en:'English',hi:'हिन्दी',ta:'தமிழ்',te:'తెలుగు',bn:'বাংলা',mr:'मराठी',gu:'ગુજરાતી',kn:'ಕನ್ನಡ',ml:'മലയാളം',pa:'ਪੰਜਾਬੀ',ur:'اردو',fr:'Français',de:'Deutsch',es:'Español',zh:'中文',ja:'日本語',pt:'Português',ar:'العربية'} as Record<string,string>)[language.split('-')[0]] || 'English');
    setCountryFlag(flags[localeCountry] || (selected === 'UK' ? '🇬🇧' : '🇺🇸'));
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
    const params = new URLSearchParams({ market, q: value });
    window.location.href = `/explore?${params.toString()}`;
  }

  function chooseNeed(value: string) {
    setQuery('');
    setHeroQuery('');
    chooseCategory(value);
  }

  function runSearch(event?: FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams({ market });
    if (heroQuery.trim()) params.set('q', heroQuery.trim());
    window.location.href = `/explore?${params.toString()}`;
  }

  const languagesByCountry: Record<string, { code: string; label: string }[]> = {
    IN: [{code:'EN',label:'English'},{code:'HI',label:'हिन्दी'},{code:'TA',label:'தமிழ்'},{code:'TE',label:'తెలుగు'},{code:'BN',label:'বাংলা'},{code:'MR',label:'मराठी'},{code:'GU',label:'ગુજરાતી'},{code:'KN',label:'ಕನ್ನಡ'},{code:'ML',label:'മലയാളം'},{code:'PA',label:'ਪੰਜਾਬੀ'},{code:'UR',label:'اردو'}],
    CA: [{code:'EN',label:'English'},{code:'FR',label:'Français'}], SG: [{code:'EN',label:'English'},{code:'ZH',label:'中文'},{code:'MS',label:'Bahasa Melayu'},{code:'TA',label:'தமிழ்'}], AE: [{code:'AR',label:'العربية'},{code:'EN',label:'English'}], CH: [{code:'DE',label:'Deutsch'},{code:'FR',label:'Français'},{code:'IT',label:'Italiano'}], ZA: [{code:'EN',label:'English'},{code:'AF',label:'Afrikaans'},{code:'ZU',label:'isiZulu'},{code:'XH',label:'isiXhosa'}]
  };
  const availableLanguages = languagesByCountry[countryCode] || [{code:languageCode,label:selectedLanguage}];

  function addToCart(product: CatalogProduct) {
    try {
      const existing = JSON.parse(localStorage.getItem('diginanba-cart') || '[]');
      const next = Array.isArray(existing) ? [...existing, {
        slug: product.slug,
        title: product.title,
        price: product.price,
        amountMinor: product.amountMinor,
        market,
      }] : [{
        slug: product.slug,
        title: product.title,
        price: product.price,
        amountMinor: product.amountMinor,
        market,
      }];
      localStorage.setItem('diginanba-cart', JSON.stringify(next));
      setCartCount(next.length);
    } catch {
      setCartCount((count) => count + 1);
    }
  }

  return <>
    <header className="ref-header">
      <div className="ref-container ref-nav">
        <Link href="/" className="ref-logo" aria-label="DigiNanba home"><img src="/diginanba-logo.svg" alt="DigiNanba — Global Digital Marketplace" className="ref-logo-image" width="168" height="36" /></Link>
        <form className="ref-searchbox ref-header-inline-search" onSubmit={runSearch}>
          <input value={heroQuery} onChange={(event) => setHeroQuery(event.target.value)} placeholder="Search products, skills or solutions…" aria-label="Search products" />
          <button className="ref-primary" type="submit">Search</button>
        </form>
        <div className="ref-actions">
          <Link className="ref-login" href="/login">Log in</Link>
          <Link className="ref-signup" href="/signup">Sign up</Link>
          <Link className="ref-cart" href="/cart" aria-label={`Cart, ${cartCount} items`}><svg className="ref-cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="20" r="1.3" fill="currentColor"/><circle cx="18" cy="20" r="1.3" fill="currentColor"/></svg><span className="ref-count">{cartCount}</span></Link>
          <div className="ref-language-wrap">
            {availableLanguages.length > 1 ? <button className="ref-language" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen} aria-label={`Choose language for ${countryCode}`} title={`Language: ${selectedLanguage}`}>
              <span className="ref-language-flag">{countryFlag}</span><span className="ref-language-chevron">▾</span>
            </button> : <div className="ref-language ref-language-static" aria-label={`Country: ${countryCode}; language: ${selectedLanguage}`} title={`Language: ${selectedLanguage}`}>
              <span className="ref-language-flag">{countryFlag}</span>
            </div>}
            {languageOpen && availableLanguages.length > 1 && <div className="ref-language-menu" role="menu" aria-label="Available languages">
              {availableLanguages.map((language) => <button key={language.code} role="menuitem" className={language.code === languageCode ? 'active' : ''} onClick={() => { setLanguageCode(language.code); setSelectedLanguage(language.label); setLanguageOpen(false); }}>{language.label}</button>)}
            </div>}
          </div>
        </div>
      </div>
    </header>

    <nav className="ref-category-nav" aria-label="Browse digital product categories">
      <div className="ref-category-nav-inner">
        <Link href="/explore">Explore</Link>
        <Link href="/explore?q=Templates">Templates</Link>
        <Link href="/explore?q=Business">Business</Link>
        <Link href="/explore?q=Finance">Finance &amp; Accounting</Link>
        <Link href="/explore?q=AI">AI &amp; Automation</Link>
        <Link href="/explore?q=Office">Office Productivity</Link>
        <Link href="/explore?q=Learning">Learning</Link>
        <Link href="/explore?q=Design">Design</Link>
        <Link href="/explore?q=Marketing">Marketing</Link>
        <Link href="/explore?q=Engineering">Engineering &amp; CAD</Link>
        <Link href="/guides">Guides</Link>
      </div>
    </nav>

    <main id="home">
      <section className="ref-hero">
        <div className="ref-container ref-market-grid">
          <div className="ref-market-left">
            <h1>Find the digital tools that solve your problem.</h1>
            <div className="ref-category-panel" id="categories">
              <div className="ref-categories">{categories.map(([icon, label]) => <button className="ref-category" key={label} onClick={() => chooseCategory(label)}><span className="ref-category-icon">{icon}</span><span><strong>{label}</strong><small>Explore products</small></span></button>)}</div>
            </div>
          </div>

          <aside className="ref-featured-panel" aria-label="Featured digital products">
            <div className="ref-featured-head"><div></div></div>
            <div className="ref-featured-grid">
              {products.slice(0, 6).map((product) => <article className="ref-featured-card" key={product.id}>
                <Link className="ref-featured-art" href={`/products/${product.slug}?market=${market}`} aria-label={`View ${product.title}`}>
                  {categories.find(([, , dbName]) => dbName === product.category)?.[0] ?? '✦'}
                </Link>
                <div className="ref-featured-body">
                  <span className="ref-tag">{product.category}</span>
                  <h3><Link href={`/products/${product.slug}?market=${market}`}>{product.title}</Link></h3>
                  <p>{product.description}</p>
                  <div className="ref-featured-footer">
                    <span className="ref-price">{product.price}</span>
                    <button className="ref-add-cart" onClick={() => addToCart(product)}>Add to cart</button>
                  </div>
                </div>
              </article>)}
            </div>
          </aside>
        </div>
      </section>

      <section className="ref-section ref-discovery-row"><div className="ref-container">
        <div className="ref-section-head"><div><h2>Trending digital products</h2><p>Popular practical resources shoppers are exploring now.</p></div><Link href="/explore" className="ref-view-product">View all →</Link></div>
        <div className="ref-products ref-horizontal">{products.slice(0,4).map((product)=><article className="ref-product" key={'trend-'+product.id}><div className="ref-product-body"><span className="ref-tag">Trending</span><h3><Link href={'/products/'+product.slug+'?market='+market}>{product.title}</Link></h3><p>{product.description}</p><div className="ref-price-row"><span className="ref-price">{product.price}</span><button className="ref-view-product" onClick={()=>addToCart(product)}>Add to cart</button></div></div></article>)}</div>
      </div></section>
      <section className="ref-section ref-discovery-row"><div className="ref-container">
        <div className="ref-section-head"><div><h2>Popular solutions</h2><p>Start with an outcome, then discover the tools that help you get there.</p></div><Link href="/solutions" className="ref-view-product">Explore solutions →</Link></div>
        <div className="ref-needs">{advancedSolutions.map(([icon,title,description,slug])=><Link className="ref-need" key={slug} href={'/solutions/'+slug}><span className="ref-solution-icon">{icon}</span><strong>{title}</strong><span className="ref-solution-description">{description}</span><span className="ref-solution-link">Explore solution →</span></Link>)}</div>
      </div></section>
      <section className="ref-section ref-discovery-row"><div className="ref-container">
        <div className="ref-section-head"><div><h2>New & useful</h2><p>Fresh resources across business, career, learning and everyday work.</p></div><Link href="/guides" className="ref-view-product">Read DigiNanba Guides →</Link></div>
        <div className="ref-products ref-horizontal">{products.slice(4,8).map((product)=><article className="ref-product" key={'new-'+product.id}><div className="ref-product-body"><span className="ref-tag">New & useful</span><h3><Link href={'/products/'+product.slug+'?market='+market}>{product.title}</Link></h3><p>{product.description}</p><div className="ref-price-row"><span className="ref-price">{product.price}</span><Link className="ref-view-product" href={'/products/'+product.slug+'?market='+market}>View →</Link></div></div></article>)}</div>
      </div></section>

      <section id="needs" className="ref-section"><div className="ref-container">
        <div className="ref-section-head"><div><h2>What are you trying to do?</h2><p>Start with your goal instead of searching through hundreds of products.</p></div></div>
        <div className="ref-needs">{needs.map(([icon, label, target]) => <button className="ref-need" key={label} onClick={() => chooseNeed(target)}>{icon} {label}</button>)}</div>
      </div></section>
    </main>

    <footer className="ref-footer"><div className="ref-container ref-footer-grid">
      <div><h3>DigiNanba</h3><p>A global marketplace for practical digital products.</p><div className="ref-note">Checkout requires sign-in. Payments remain in demo mode until a provider is configured.</div></div>
      <div><h4>Marketplace</h4><Link href="/explore">Explore products</Link><Link href="/categories/ebooks-guides">Categories</Link><Link href="/solutions">Shop by goal</Link><Link href="/guides">DigiNanba Guides</Link></div>
      <div><h4>Account</h4><Link href="/login">Log in</Link><Link href="/signup">Create account</Link><Link href="/cart">Cart</Link></div>
      <div><h4>For creators</h4><Link href="/signup">Become a seller</Link><Link href="/explore">Seller resources</Link><Link href="/account">Help center</Link></div>
    </div></footer>


  </>;
}
