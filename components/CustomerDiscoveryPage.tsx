'use client';

import { useEffect, useState } from 'react';

type Listing = { id: string; title: string; description?: string; category: string; priceAmount?: number | null; currency?: string | null; priceUnit?: string | null };
type ShopOrProvider = { id: string; business_name: string; description?: string; city?: string; district?: string; region?: string; locality?: string; listings: Listing[] };
type Props = { kind: 'shops' | 'services'; title: string; intro: string; categories: string[] };

const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, padding: '13px 14px', border: '1px solid #d0d5dd', borderRadius: 12, background: '#fff', color: '#172033', font: 'inherit' };
const chipStyle: React.CSSProperties = { border: '1px solid #d0d5dd', borderRadius: 999, padding: '9px 13px', background: '#fff', color: '#344054', cursor: 'pointer', font: 'inherit', fontSize: 13 };

export default function CustomerDiscoveryPage({ kind, title, intro, categories }: Props) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<ShopOrProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    if (city.trim()) params.set('city', city.trim());
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch('/api/marketplace/' + kind + '?' + params.toString())
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load listings.');
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(err => { if (!cancelled) { setItems([]); setError(err instanceof Error ? err.message : 'Could not load listings.'); } })
      .finally(() => { if (!cancelled) { setLoading(false); setSearched(true); } });
    return () => { cancelled = true; };
  }, [kind, query, category, city]);

  return (
    <main style={{ maxWidth: 1160, margin: '0 auto', padding: '38px 20px 76px', color: '#172033' }}>
      <p style={{ margin: '0 0 9px', color: '#5264b5', fontSize: 12, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' }}>DigiNanba local discovery</p>
      <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(32px,5vw,48px)', lineHeight: 1.08, letterSpacing: '-.04em' }}>{title}</h1>
      <p style={{ maxWidth: 780, margin: 0, color: '#475467', fontSize: 17, lineHeight: 1.65 }}>{intro}</p>

      <section aria-label="Find nearby shops and services" style={{ marginTop: 26, padding: 'clamp(18px,3vw,28px)', border: '1px solid #e4e7ec', borderRadius: 20, background: 'linear-gradient(135deg,#f7f9ff,#fff 70%)', boxShadow: '0 8px 24px rgba(16,24,40,.05)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 21 }}>What are you looking for?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 10 }}>
          <input aria-label="Search shops, products or services" style={inputStyle} value={query} onChange={e => setQuery(e.target.value)} placeholder={kind === 'shops' ? 'Search grocery, vegetables, medical shop…' : 'Search electrician, plumber, repair…'} />
          <input aria-label="City or area" style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="City or area (e.g. Trichy)" />
        </div>
        <div style={{ marginTop: 18 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#475467' }}>Browse by need</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={() => setCategory('')} style={{ ...chipStyle, background: category === '' ? '#263c91' : '#fff', borderColor: category === '' ? '#263c91' : '#d0d5dd', color: category === '' ? '#fff' : '#344054' }}>All</button>
            {categories.map(item => <button key={item} type="button" onClick={() => setCategory(category === item ? '' : item)} style={{ ...chipStyle, background: category === item ? '#263c91' : '#fff', borderColor: category === item ? '#263c91' : '#d0d5dd', color: category === item ? '#fff' : '#344054' }}>{item}</button>)}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{category || (kind === 'shops' ? 'Shops around you' : 'Services you may need')}</h2>
          <span style={{ color: '#667085', fontSize: 13 }}>{loading ? 'Searching…' : items.length + ' results'}</span>
        </div>
        {error ? <p role="alert" style={{ color: '#b42318' }}>{error}</p> : null}
        {!loading && searched && items.length === 0 && (
          <div style={{ marginTop: 14, padding: 22, border: '1px dashed #cbd5e1', borderRadius: 16, background: '#f8fafc' }}>
            <strong>No verified listings found for this search yet.</strong>
            <p style={{ margin: '7px 0 0', color: '#667085', lineHeight: 1.55 }}>Try another category or nearby area. DigiNanba will show shops and providers here as verified listings become available.</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 14, marginTop: 14 }}>
          {items.map(item => (
            <article key={item.id} style={{ border: '1px solid #e4e7ec', borderRadius: 16, padding: 18, background: '#fff', display: 'grid', gap: 9 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{item.business_name}</h3>
              <p style={{ margin: 0, color: '#667085', fontSize: 13 }}>{[item.locality, item.city, item.district, item.region].filter(Boolean).join(', ')}</p>
              {item.description ? <p style={{ margin: 0, color: '#475467', fontSize: 14, lineHeight: 1.5 }}>{item.description}</p> : null}
              {item.listings?.length ? <div style={{ display: 'grid', gap: 7, borderTop: '1px solid #eaecf0', paddingTop: 10 }}>
                {item.listings.map(listing => <div key={listing.id}>
                  <strong style={{ fontSize: 14 }}>{listing.title}</strong>
                  <p style={{ margin: '3px 0 0', color: '#667085', fontSize: 12 }}>{listing.category}{listing.priceAmount != null ? ' · ' + (listing.currency || '') + ' ' + listing.priceAmount + (listing.priceUnit ? ' / ' + listing.priceUnit : '') : ''}</p>
                </div>)}
              </div> : null}
              <span style={{ justifySelf: 'start', borderRadius: 999, background: '#ecfdf3', color: '#027a48', padding: '5px 9px', fontSize: 11, fontWeight: 800 }}>Verified listing</span>
            </article>
          ))}
        </div>
      </section>
      <p style={{ marginTop: 30, color: '#667085', fontSize: 12, lineHeight: 1.55 }}>You do not need to own a shop or provide a service to use this section. It is designed for customers looking for everyday shops and services.</p>
    </main>
  );
}
