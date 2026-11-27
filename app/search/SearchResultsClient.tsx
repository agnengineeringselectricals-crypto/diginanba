'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

type Result = Record<string, any>;
type Props = { initialQuery: string; market: 'IN' | 'UK' | 'US' };

const areas = [
  { key: 'products', label: 'Digital products', endpoint: 'products' },
  { key: 'shops', label: 'Shops', endpoint: 'shops' },
  { key: 'services', label: 'Services', endpoint: 'services' },
  { key: 'professionals', label: 'Professionals', endpoint: 'professionals' },
  { key: 'healthcare', label: 'Doctors & healthcare', endpoint: 'healthcare' },
  { key: 'career', label: 'Jobs & careers', endpoint: 'career' },
  { key: 'organizations', label: 'Your organization workspaces', endpoint: 'organizations' },
] as const;

function titleOf(item: Result, key: string) {
  if (key === 'products') return item.title || 'Digital product';
  if (key === 'healthcare') return item.display_name || 'Healthcare provider';
  if (key === 'organizations') return item.name || 'Organization workspace';
  if (key === 'career') return item.title || 'Job opportunity';
  return item.business_name || item.display_name || item.title || 'Listing';
}
function detailOf(item: Result, key: string) {
  if (key === 'products') return [item.category, item.creatorName ? 'by ' + item.creatorName : ''].filter(Boolean).join(' · ');
  if (key === 'healthcare') return [item.specialty, item.provider_type, item.locality, item.city, item.district].filter(Boolean).join(' · ');
  if (key === 'organizations') return [item.role, item.status, item.billing_country_code].filter(Boolean).join(' · ');
  if (key === 'career') return [item.company_name, item.city, item.region].filter(Boolean).join(' · ');
  return [item.specialty || item.provider_type, item.locality, item.city, item.district, item.region].filter(Boolean).join(' · ');
}
function hrefOf(item: Result, key: string, market: string) {
  if (key === 'products' && item.slug) return '/products/' + encodeURIComponent(item.slug) + '?market=' + market;
  if (key === 'shops' && item.public_id) return '/s/' + encodeURIComponent(item.public_id);
  if (key === 'organizations' && item.id) return '/organizations/modules?organizationId=' + encodeURIComponent(item.id);
  if (key === 'shops') return '/shops?q=' + encodeURIComponent(item.business_name || '');
  return '/' + key + '?q=' + encodeURIComponent(item.business_name || item.display_name || item.title || '');
}

export default function SearchResultsClient({ initialQuery, market }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Record<string, Result[]>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = initialQuery.trim();
    const locationMatch = term.match(/^(.+?)\\s+(?:in|near|around)\\s+(.+)$/i);
    const searchTerm = locationMatch ? locationMatch[1].trim() : term;
    const searchCity = locationMatch ? locationMatch[2].trim() : '';
    setQuery(term);
    if (term.length < 2) { setResults({}); setSearched(false); return; }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const requests = areas.map(async area => {
      try {
        const url = area.key === 'products'
          ? '/api/products?market=' + market + '&q=' + encodeURIComponent(searchTerm)
          : area.key === 'organizations'
            ? '/api/organizations'
            : '/api/marketplace/' + area.endpoint + '?q=' + encodeURIComponent(searchTerm) + (searchCity && area.key !== 'career' ? '&city=' + encodeURIComponent(searchCity) : searchCity ? '&city=' + encodeURIComponent(searchCity) : '');
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return [area.key, []] as const;
        const data = await response.json();
        let rows = area.key === 'products' ? data.products
          : area.key === 'healthcare' ? data.providers
          : area.key === 'career' ? data.jobs
          : area.key === 'organizations' ? data.organizations
          : data.items;
        if (area.key === 'organizations' && Array.isArray(rows)) {
          rows = rows.filter((item: Result) => String(item.name || '').toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()));
        }
        return [area.key, Array.isArray(rows) ? rows : []] as const;
      } catch {
        return [area.key, []] as const;
      }
    });
    Promise.all(requests).then(entries => {
      if (active) setResults(Object.fromEntries(entries));
    }).finally(() => {
      if (active) { setLoading(false); setSearched(true); }
    });
    return () => { active = false; controller.abort(); };
  }, [initialQuery, market]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term) window.location.href = '/search?q=' + encodeURIComponent(term) + '&market=' + market;
  }

  const total = areas.reduce((sum, area) => sum + (results[area.key]?.length || 0), 0);
  return <main style={{ maxWidth: 1160, margin: '0 auto', padding: '34px 20px 80px', color: '#172033' }}>
    <Link href="/" style={{ display: 'inline-flex', marginBottom: 22, color: '#344c9a', fontWeight: 700 }}>← Home</Link>
    <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(30px,5vw,44px)' }}>Search DigiNanba</h1>
    <p style={{ margin: '0 0 22px', color: '#667085' }}>Search across shops, services, products, professionals, healthcare and careers.</p>
    <form onSubmit={submit} role="search" style={{ display: 'flex', gap: 10, padding: 8, background: '#fff', border: '1px solid #d0d5dd', borderRadius: 16, boxShadow: '0 8px 24px rgba(16,24,40,.06)' }}>
      <input autoFocus type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="What are you looking for?" aria-label="Search all of DigiNanba" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, padding: '12px 14px', font: 'inherit', fontSize: 16 }} />
      <button type="submit" disabled={!query.trim()} style={{ border: 0, borderRadius: 11, padding: '0 22px', background: '#344c9a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Search</button>
    </form>
    {loading && <p role="status" style={{ color: '#667085', marginTop: 22 }}>Searching all DigiNanba categories…</p>}
    {error && <p role="alert" style={{ color: '#b42318', marginTop: 18 }}>{error}</p>}
    {searched && !loading && !error && <p style={{ color: '#667085', margin: '22px 0 8px' }}>{total} matching results for <strong>“{initialQuery}”</strong></p>}
    {searched && !loading && !error && total === 0 && <section style={{ marginTop: 18, padding: 22, border: '1px dashed #cbd5e1', borderRadius: 16, background: '#f8fafc' }}>
      <strong>No matching public listings found yet.</strong>
      <p style={{ color: '#667085', lineHeight: 1.6 }}>Try a different phrase or search by a product, shop name, service, profession, doctor, job title or location.</p>
    </section>}
    <div style={{ display: 'grid', gap: 22, marginTop: 22 }}>
      {areas.map(area => {
        const rows = results[area.key] || [];
        if (!rows.length) return null;
        return <section key={area.key}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{area.label}</h2>
            <span style={{ color: '#667085', fontSize: 12 }}>{rows.length} results</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 12 }}>
            {rows.slice(0, 12).map((item, index) => <Link key={String(item.id || item.slug || index)} href={hrefOf(item, area.key, market)} style={{ display: 'block', padding: 16, border: '1px solid #e4e7ec', borderRadius: 14, background: '#fff', color: '#172033' }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>{titleOf(item, area.key)}</strong>
              <span style={{ display: 'block', color: '#667085', fontSize: 13, lineHeight: 1.5 }}>{detailOf(item, area.key) || item.description?.slice(0, 150) || 'View details'}</span>
              {area.key === 'products' && item.price ? <span style={{ display: 'block', marginTop: 9, color: '#344c9a', fontWeight: 800 }}>{item.price}</span> : null}
              <span style={{ display: 'inline-block', marginTop: 10, color: '#344c9a', fontSize: 12, fontWeight: 800 }}>View result →</span>
            </Link>)}
          </div>
        </section>;
      })}
    </div>
    <section style={{ marginTop: 30, padding: 18, border: '1px solid #e4e7ec', borderRadius: 14, background: '#f8fafc' }}>
      <strong>Looking for an organization or project workspace?</strong>
      <p style={{ margin: '6px 0 12px', color: '#667085' }}>Create and manage your own organization, teams and projects on DigiNanba.</p>
      <Link href="/organizations" style={{ color: '#344c9a', fontWeight: 800 }}>Open My Organisation &amp; Projects →</Link>
    </section>
  </main>;
}
