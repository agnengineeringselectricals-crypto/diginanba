'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CatalogProduct } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import CreatorEarningsShowcase from './CreatorEarningsShowcase';
import ProductRequestWorkspace from '@/components/ProductRequestWorkspace';
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

type Props = { initialProducts: CatalogProduct[]; initialMarket: Market };

export default function HomePageClient({ initialProducts, initialMarket }: Props) {
  const [market, setMarket] = useState<Market>('US');
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [heroQuery, setHeroQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<CatalogProduct[]>([]);
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchNoResults, setSearchNoResults] = useState(false);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [countryCode, setCountryCode] = useState('US');
  const [cartCount, setCartCount] = useState(0);
  const [languageCode, setLanguageCode] = useState('EN');
  const [countryFlag, setCountryFlag] = useState('🇺🇸');
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  useEffect(() => {
    const savedMarket = localStorage.getItem('diginanba-market') as Market | null;
    const selected: Market = savedMarket === 'US' || savedMarket === 'UK' || savedMarket === 'IN' ? savedMarket : initialMarket;
    setMarket(selected);
    const language = (navigator.language || 'en-US').toLowerCase();
    const localeCountry = selected === 'UK' ? 'GB' : selected === 'IN' ? 'IN' : 'US';
    const languagePart = (language.split('-')[0] || 'en').toUpperCase().slice(0, 2);
    const flags: Record<string, string> = { US:'🇺🇸', GB:'🇬🇧', IN:'🇮🇳', CA:'🇨🇦', AU:'🇦🇺', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', IT:'🇮🇹', JP:'🇯🇵', CN:'🇨🇳', BR:'🇧🇷', AE:'🇦🇪', SG:'🇸🇬' };
    setCountryCode(localeCountry);
    setLanguageCode(languagePart);
    setSelectedLanguage(({en:'English',hi:'हिन्दी',ta:'தமிழ்',te:'తెలుగు',bn:'বাংলা',mr:'मराठी',gu:'ગુજરાતી',kn:'ಕನ್ನಡ',ml:'മലയാളം',pa:'ਪੰਜਾਬੀ',ur:'اردو',fr:'Français',de:'Deutsch',es:'Español',zh:'中文',ja:'日本語',pt:'Português',ar:'العربية'} as Record<string,string>)[language.split('-')[0]] || 'English');
    setCountryFlag(flags[localeCountry] || '🇺🇸');
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

  useEffect(() => {
    const term = heroQuery.trim();
    if (term.length < 2) { setSearchSuggestions([]); setSearchNoResults(false); setSearchLoading(false); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        let visitorId = localStorage.getItem('diginanba-search-visitor');
        if (!visitorId) {
          visitorId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem('diginanba-search-visitor', visitorId);
        }
        const response = await fetch('/api/search/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: term, market, locale: navigator.language || 'en', visitorId, source: 'search_bar' }) });
        const data = await response.json();
        if (!cancelled) { setSearchSuggestions(Array.isArray(data.products) ? data.products : []); setSearchNoResults(data.noResults === true); setSearchSuggestionsOpen(true); }
      } catch { if (!cancelled) { setSearchSuggestions([]); setSearchNoResults(false); } }
      finally { if (!cancelled) setSearchLoading(false); }
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [heroQuery, market]);

  const currency = market === 'UK' ? 'GBP' : market === 'IN' ? 'INR' : 'USD';
  const marketName = market === 'UK' ? 'United Kingdom' : market === 'IN' ? 'India' : 'United States';
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
    const categoryName = categories.find(([, label]) => label === value)?.[2] ?? value;
    const params = new URLSearchParams({ market, q: categoryName });
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
      const parsed: unknown = JSON.parse(localStorage.getItem('diginanba-cart') || '[]');
      const existing = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
      const next = [...existing];
      const index = next.findIndex((item) => item.slug === product.slug && item.market === market);
      if (index >= 0) {
        const quantity = Math.min(10, Math.max(1, Number(next[index].quantity) || 1) + 1);
        next[index] = { ...next[index], quantity };
      } else {
        next.push({ slug: product.slug, title: product.title, price: product.price, amountMinor: product.amountMinor, market, quantity: 1 });
      }
      localStorage.setItem('diginanba-cart', JSON.stringify(next));
      setCartCount(next.reduce((total, item) => total + Math.min(10, Math.max(1, Number(item.quantity) || 1)), 0));
    } catch {
      setCartCount((count) => count + 1);
    }
  }

  return <>
    <header className="ref-header">
      <div className="ref-container ref-nav">
        <Link href="/" className="ref-logo" aria-label="DigiNanba home"><img src="/diginanba-logo.svg" alt="DigiNanba — Global Digital Marketplace" className="ref-logo-image" width="168" height="36" /></Link>
        <form className="ref-searchbox ref-header-inline-search" style={{ position: 'relative' }} onSubmit={runSearch}>
          <input value={heroQuery} onFocus={() => { if (heroQuery.trim().length >= 2) setSearchSuggestionsOpen(true); }} onChange={(event) => { setHeroQuery(event.target.value); setSearchSuggestionsOpen(true); }} placeholder="Search tools, templates, apps or workflows…" aria-label="Search digital tools and products" autoComplete="off" />
          <button className="ref-primary" type="submit">Search</button>
          {searchSuggestionsOpen && heroQuery.trim().length >= 2 && <div className="dn-live-search-results" role="region" aria-label="Product search suggestions" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 1000, background: '#fff', color: '#172033', border: '1px solid #dfe3ed', borderRadius: 12, boxShadow: '0 14px 35px rgba(20,30,60,.18)', maxHeight: 420, overflowY: 'auto', padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', fontSize: 12, color: '#667085' }}><span>Matching tools &amp; products</span><button type="button" onClick={() => setSearchSuggestionsOpen(false)} aria-label="Close suggestions" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>✕</button></div>
            {searchLoading && <p style={{ margin: 10, fontSize: 13 }}>Finding relevant tools and products…</p>}
            {!searchLoading && searchSuggestions.map((product) => <Link key={product.id} href={`/products/${product.slug}?market=${market}`} onClick={() => setSearchSuggestionsOpen(false)} style={{ display: 'block', padding: '10px', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
              <strong style={{ display: 'block', fontSize: 14 }}>{product.title}</strong><span style={{ display: 'block', color: '#667085', fontSize: 12, marginTop: 3 }}>{product.category} · {product.price}</span><span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{product.description.slice(0, 130)}</span>
            </Link>)}
            {!searchLoading && searchNoResults && <div style={{ padding: 12, fontSize: 13 }}><strong>No close match yet.</strong><p style={{ margin: '5px 0 9px' }}>Explore related listings or tell DigiNanba what kind of tool you need. New-tool requests are not a promise that a product is already available.</p><Link href={`/customize?q=${encodeURIComponent(heroQuery.trim())}`} onClick={() => setSearchSuggestionsOpen(false)}>Request a tailored tool →</Link></div>}
            {!searchLoading && searchSuggestions.length > 0 && <button type="submit" style={{ width: '100%', textAlign: 'left', padding: 10, border: 0, borderTop: '1px solid #e7eaf0', background: 'transparent', cursor: 'pointer' }}>See all results for “{heroQuery.trim()}” →</button>}
          </div>}
        </form>
        <div className="ref-actions">
          <Link className="ref-login" href="/login">Log in</Link>
          <Link className="ref-signup" href="/signup">Sign up</Link>
          <Link className="ref-cart" href="/cart" aria-label={`Cart, ${cartCount} items`}><svg className="ref-cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="20" r="1.3" fill="currentColor"/><circle cx="18" cy="20" r="1.3" fill="currentColor"/></svg><span className="ref-count">{cartCount}</span></Link>
          <div className="ref-language-wrap">
            <button className="ref-language" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen} aria-label={`Country and language: ${countryCode}, ${selectedLanguage}`} title={`Country: ${countryCode} · Language: ${selectedLanguage}`}>
              <span className="ref-language-flag">{countryFlag}</span><span>{languageCode}</span><span className="ref-language-chevron">▾</span>
            </button>
            {languageOpen && <div className="ref-language-menu" role="menu" aria-label="Country and language settings">
              <strong className="ref-language-menu-heading">Store country</strong>
              {[{market:'US' as Market,code:'US',flag:'🇺🇸',label:'United States'},{market:'UK' as Market,code:'GB',flag:'🇬🇧',label:'United Kingdom'},{market:'IN' as Market,code:'IN',flag:'🇮🇳',label:'India'}].map((option) => <button key={option.market} role="menuitem" className={market === option.market ? 'active' : ''} onClick={() => { setMarket(option.market); setCountryCode(option.code); setCountryFlag(option.flag); localStorage.setItem('diginanba-market', option.market); setLanguageOpen(false); }}>{option.flag} {option.label}</button>)}
              <strong className="ref-language-menu-heading">Language preference</strong>
              {availableLanguages.map((language) => <button key={language.code} role="menuitem" className={language.code === languageCode ? 'active' : ''} onClick={() => { setLanguageCode(language.code); setSelectedLanguage(language.label); setLanguageOpen(false); }}>{language.code} · {language.label}</button>)}
            </div>}
          </div>
        </div>
      </div>
    </header>

    <nav className="ref-category-nav" aria-label="Browse digital product categories">
      <div className="ref-category-nav-inner">
        <Link href={`/explore?market=${market}`}>Explore</Link>
        <Link href={`/explore?market=${market}&q=Templates`}>Templates</Link>
        <Link href={`/explore?market=${market}&q=Business`}>Business</Link>
        <Link href={`/explore?market=${market}&q=Finance`}>Finance &amp; Accounting</Link>
        <Link href={`/explore?market=${market}&q=AI`}>AI &amp; Automation</Link>
        <Link href={`/explore?market=${market}&q=Office`}>Office Productivity</Link>
        <Link href={`/explore?market=${market}&q=Learning`}>Learning</Link>
        <Link href={`/explore?market=${market}&q=Design`}>Design</Link>
        <Link href={`/explore?market=${market}&q=Marketing`}>Marketing</Link>
        <Link href={`/explore?market=${market}&q=Engineering`}>Engineering &amp; CAD</Link>
        <Link href="/guides">Guides</Link>
      </div>
    </nav>

    <main id="home">

      <div className="ref-container"><ProductRequestWorkspace /></div>

      <section className="ref-hero">
        <div className="ref-container ref-market-grid ref-market-grid-single">
          <div className="ref-market-left">
            <form className="dn-goal-search dn-hero-goal-search" onSubmit={(event)=>{event.preventDefault();const input=event.currentTarget.elements.namedItem('goal') as HTMLInputElement;const value=input.value.trim();if(value){const params=new URLSearchParams({market,q:value});window.location.href='/explore?'+params.toString();}}}><input name="goal" aria-label="Describe what you want to accomplish" placeholder="What do you need? e.g. HR workflow, inventory, study planner, meal planner…" /><button className="ref-primary" type="submit">Find tools →</button></form>
            <h1>Find the digital tools that solve your problem.</h1><p className="dn-marketplace-intro">Discover existing products first. Review the options, then choose a tool that fits your work, studies, business, home or organization.</p>
            <div className="ref-category-panel" id="categories">
              <div className="ref-category-scroll" aria-label="Scroll to browse all product categories"><div className="ref-categories">{categories.map(([icon, label]) => <button className="ref-category" key={label} onClick={() => chooseCategory(label)}><span className="ref-category-icon">{icon}</span><span className="ref-category-copy"><strong>{label}</strong><small>Explore products</small></span></button>)}</div></div>
            </div>
          </div>

        </div>
      </section>

      <section className="dn-buyer-confidence" aria-labelledby="dn-buyer-confidence-title">
        <div className="ref-container dn-buyer-confidence-inner">
          <div className="dn-buyer-confidence-intro">
            <span className="dn-buyer-confidence-eyebrow">BUY WITH CLARITY</span>
            <h2 id="dn-buyer-confidence-title">Know what you’re choosing before you buy.</h2>
            <p>Open a product page to review its details and check the guidance on intended use, license, file compatibility and access.</p>
          </div>
          <div className="dn-buyer-confidence-points">
            <div><span aria-hidden="true">ⓘ</span><strong>Product details</strong><small>Understand what each resource is designed to help you do.</small></div>
            <div><span aria-hidden="true">✓</span><strong>Before-you-buy guidance</strong><small>Review license, file compatibility and delivery notes where provided.</small></div>
            <div><span aria-hidden="true">↗</span><strong>Compare your options</strong><small>Explore alternatives before deciding which tool fits your needs.</small></div>
          </div>
          <div className="dn-buyer-confidence-actions">
            <Link href="/explore" className="ref-primary">Explore products →</Link>
            <Link href="/compare" className="dn-buyer-compare-link">Compare products</Link>
          </div>
        </div>
      </section>

      <CreatorEarningsShowcase />

      <section className="dn-organization-pathways" aria-labelledby="dn-organization-title">
        <div className="ref-container">
          <div className="dn-organization-heading">
            <div><span className="dn-organization-kicker">FOR ORGANIZATIONS &amp; TEAMS</span><h2 id="dn-organization-title">Find tools for the way your organization works.</h2><p>Explore existing resources for department workflows and business operations. Review each listing to confirm its capabilities, access model and pricing before adopting it.</p></div>
          </div>
          <div className="dn-organization-grid">
            <Link href={`/explore?market=${market}&q=${encodeURIComponent('HR employee onboarding workflow')}`} className="dn-organization-card"><span aria-hidden="true">👥</span><strong>HR &amp; people workflows</strong><small>Explore onboarding checklists, recruitment trackers, training resources and employee process templates.</small><em>Find HR tools →</em></Link>
            <Link href={`/explore?market=${market}&q=${encodeURIComponent('inventory stock billing invoices')}`} className="dn-organization-card"><span aria-hidden="true">📦</span><strong>Inventory, billing &amp; finance</strong><small>Look for stock registers, invoice templates, purchase tracking and reporting resources.</small><em>Find operations tools →</em></Link>
            <Link href={`/explore?market=${market}&q=${encodeURIComponent('project management approval workflow')}`} className="dn-organization-card"><span aria-hidden="true">🗂️</span><strong>Projects &amp; approvals</strong><small>Discover project trackers, task planning, approval flows and team operating templates.</small><em>Find workflow tools →</em></Link>
          </div>
          <div className="dn-organization-workspace-cta"><div><strong>Need shared tools for your whole team?</strong><span>Create a workspace to organize digital tools for your whole team.</span></div><Link className="ref-primary" href="/organizations">Set up an organization →</Link></div>
            </div>
      </section>

      <section className="ref-section dn-feature-map"><div className="ref-container">
        <div className="ref-section-head"><div><h2>Find, review and choose with confidence</h2><p>Explore digital resources for everyday life, learning, independent work, small businesses and teams. Review the product details before deciding.</p></div></div>
        <div className="dn-feature-grid">
          <Link href="/explore"><span>🔎</span><strong>Discover digital tools</strong><small>Search, browse categories and find resources for your goals.</small></Link>
          <Link href="/compare"><span>⚖️</span><strong>Compare products</strong><small>Review features, descriptions and prices side by side before choosing.</small></Link>
          <Link href="/bundles"><span>🧰</span><strong>Curated bundles</strong><small>Browse collections of complementary digital resources.</small></Link>
          <Link href="/account/wishlist"><span>♡</span><strong>Save your favorites</strong><small>Keep a wishlist and access it again when you are ready.</small></Link>
          <Link href="/explore"><span>ⓘ</span><strong>Review product details</strong><small>Check descriptions, prices and product information before choosing.</small></Link>
          <Link href="/account/orders"><span>🧾</span><strong>Orders & purchases</strong><small>View your order history from your signed-in account.</small></Link>
          <Link href="/account/library"><span>📚</span><strong>Customer library</strong><small>Find digital items made available to your account after an eligible order is fulfilled.</small></Link>
          <Link href="/signup"><span>✨</span><strong>Create from what you know</strong><small>Students, homemakers, retired people, professionals and organizations can all have useful ideas worth turning into digital resources.</small></Link>
          <Link href="/guides"><span>🌍</span><strong>Learn and grow</strong><small>Read practical guides and discover new ways to work.</small></Link>
        </div>
      </div></section>

      <section id="needs" className="ref-section"><div className="ref-container">
        <div className="ref-section-head"><div><h2>What would you like to get done?</h2><p>From school projects and household planning to freelance work, business operations and organization workflows, start with the problem you want to solve.</p></div></div>
        <div className="ref-needs">{needs.map(([icon, label, target]) => <button className="ref-need" key={label} onClick={() => chooseNeed(target)}>{icon} {label}</button>)}</div>
      </div></section>
      <section className="ref-section ref-discovery-row"><div className="ref-container">
        <div className="ref-section-head"><div><h2>Trending digital products</h2><p>Discover practical digital tools for work, learning and everyday tasks.</p></div><Link href="/explore" className="ref-view-product">View all →</Link></div>
        <div className="ref-products ref-horizontal">{products.slice(0,4).map((product)=><article className="ref-product dn-clickable-card" key={'trend-'+product.id}><Link className="dn-card-hit-area" href={`/products/${product.slug}?market=${market}`} aria-label={`View ${product.title}`} tabIndex={-1} /><div className="ref-product-body"><span className="ref-tag">Featured</span><h3><Link href={'/products/'+product.slug+'?market='+market}>{product.title}</Link></h3><p>{product.description}</p><div className="ref-price-row"><span className="ref-price">{product.price}</span><button className="ref-view-product" onClick={(event)=>{event.stopPropagation();addToCart(product)}}>Add to cart</button></div></div></article>)}</div>
      </div></section>
      <section className="ref-section ref-discovery-row"><div className="ref-container">
        <div className="ref-section-head"><div><h2>Popular solutions</h2><p>Start with an outcome, then discover the tools that help you get there.</p></div><Link href="/solutions" className="ref-view-product">Explore solutions →</Link></div>
        <div className="ref-needs">{advancedSolutions.map(([icon,title,description,slug])=><Link className="ref-need" key={slug} href={'/solutions/'+slug}><span className="ref-solution-icon">{icon}</span><strong>{title}</strong><span className="ref-solution-description">{description}</span><span className="ref-solution-link">Explore solution →</span></Link>)}</div>
      </div></section>
      <section className="ref-section ref-discovery-row"><div className="ref-container">
        <div className="ref-section-head"><div><h2>More useful digital products</h2><p>Explore additional resources across business, career, learning and everyday work.</p></div><Link href="/explore" className="ref-view-product">View all products →</Link></div>
        <div className="ref-products ref-horizontal">{products.slice(4,8).map((product)=><article className="ref-product dn-clickable-card" key={'new-'+product.id}><Link className="dn-card-hit-area" href={`/products/${product.slug}?market=${market}`} aria-label={`View ${product.title}`} tabIndex={-1} /><div className="ref-product-body"><span className="ref-tag">Explore</span><h3><Link href={'/products/'+product.slug+'?market='+market}>{product.title}</Link></h3><p>{product.description}</p><div className="ref-price-row"><span className="ref-price">{product.price}</span><Link className="ref-view-product" href={'/products/'+product.slug+'?market='+market}>View →</Link></div></div></article>)}</div>
      </div></section>


    </main>

    <footer className="ref-footer"><div className="ref-container ref-footer-grid">
      <div><h3>DigiNanba</h3><p>A global marketplace for practical digital products.</p><div className="ref-note">Checkout requires sign-in. Secure payment availability is shown at checkout; payment confirmation is required before downloads are unlocked.</div></div>
      <div><h4>Marketplace</h4><Link href="/explore">Explore products</Link><Link href="/explore?market=US&category=Ebooks%20%26%20Guides">Categories</Link><Link href="/solutions">Shop by goal</Link><Link href="/bundles">Product bundles</Link><Link href="/compare">Compare products</Link><Link href="/guides">DigiNanba Guides</Link></div>
      <div><h4>Account</h4><Link href="/login">Log in</Link><Link href="/signup">Create account</Link><Link href="/cart">Cart</Link><Link href="/account/orders">Orders &amp; purchases</Link><Link href="/account/wishlist">Wishlist</Link></div>
      <div><h4>For creators</h4><Link href="/signup">Become a seller</Link><Link href="/explore">Seller resources</Link><Link href="/account">My account</Link><Link href="/creator-agreement">Creator Agreement</Link></div>
      <div><h4>Policies &amp; support</h4><Link href="/terms">Terms &amp; Conditions</Link><Link href="/privacy">Privacy Policy</Link><Link href="/copyright">Copyright Policy</Link><Link href="/refunds">Refund &amp; Cancellation</Link><Link href="/contact">Contact &amp; Support</Link></div>
    </div>
    <div className="ref-container dn-social-ribbon">
      <div className="dn-social-copy"><strong>Share DigiNanba</strong><span>Help more creators discover new possibilities.</span></div>
      <div className="dn-social-links" aria-label="Share DigiNanba on social media">
        <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdiginanba.com" target="_blank" rel="noreferrer" aria-label="Share on Facebook" title="Share on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8z"/></svg></a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdiginanba.com" target="_blank" rel="noreferrer" aria-label="Share on LinkedIn" title="Share on LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM3.6 9h3.2v11H3.6zm5.2 0h3.1v1.5h.1a3.4 3.4 0 0 1 3.1-1.7c3.3 0 3.9 2.1 3.9 4.8V20h-3.2v-5.7c0-1.4 0-3-1.9-3s-2.1 1.5-2.1 2.9V20H8.8z"/></svg></a>
        <a href="https://twitter.com/intent/tweet?url=https%3A%2F%2Fdiginanba.com&text=Discover%20digital%20tools%20and%20creator%20resources%20on%20DigiNanba" target="_blank" rel="noreferrer" aria-label="Share on X" title="Share on X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3H22l-6.8 7.8L23.2 21h-6.3L12 14.8 6.5 21H3.4l7.3-8.4L2.8 3h6.4l4.5 5.9zm-1.1 16h1.7L8.2 4.9H6.4z"/></svg></a>
        <a href="https://api.whatsapp.com/send?text=Discover%20DigiNanba%20digital%20products%20https%3A%2F%2Fdiginanba.com" target="_blank" rel="noreferrer" aria-label="Share on WhatsApp" title="Share on WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.7 9.7 0 0 0-8.3 14.8L2.4 22l5.4-1.4A9.8 9.8 0 1 0 12 2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-3.2.8.9-3.1-.2-.3A8 8 0 1 1 12 19.8Zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1s-.6.8-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.1 7.1 0 0 1-1.3-1.6c-.1-.2 0-.3.1-.5l.4-.4.2-.4c.1-.1 0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3s-.8.8-.8 2 .8 2.3.9 2.5a9.1 9.1 0 0 0 3.5 3.1c.5.2.9.4 1.2.4.5.1 1 .1 1.4-.1.4-.2 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2s-.2-.2-.4-.3Z"/></svg></a>
      </div>
    </div></footer>


  </>;
}
