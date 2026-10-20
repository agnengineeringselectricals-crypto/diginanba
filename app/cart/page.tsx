'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Market = 'US' | 'UK' | 'IN';
type Item = { slug: string; title: string; price: string; amountMinor: number; market: Market; quantity?: number };
function normalize(items: Item[]) {
  const grouped = new Map<string, Item>();
  for (const item of items) {
    if (!item?.slug || !['US','UK','IN'].includes(item.market)) continue;
    const key = item.market + ':' + item.slug;
    const previous = grouped.get(key);
    grouped.set(key, { ...item, quantity: Math.min(10, Math.max(1, (previous?.quantity || 0) + (item.quantity || 1))) });
  }
  return [...grouped.values()];
}
const currency = (market: Market) => market === 'IN' ? 'INR' : market === 'UK' ? 'GBP' : 'USD';
const locale = (market: Market) => market === 'IN' ? 'en-IN' : market === 'UK' ? 'en-GB' : 'en-US';
const marketName = (market: Market) => market === 'IN' ? 'India · INR' : market === 'UK' ? 'United Kingdom · GBP' : 'United States · USD';

export default function Cart() {
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const raw = JSON.parse(localStorage.getItem('diginanba-cart') || '[]'); setItems(normalize(Array.isArray(raw) ? raw : [])); }
    catch { setItems([]); }
    setReady(true);
  }, []);
  function persist(next: Item[]) {
    const clean = normalize(next);
    setItems(clean);
    localStorage.setItem('diginanba-cart', JSON.stringify(clean));
  }
  function changeQuantity(item: Item, delta: number) {
    persist(items.map((x) => x.slug === item.slug && x.market === item.market ? { ...x, quantity: Math.min(10, Math.max(1, (x.quantity || 1) + delta)) } : x));
  }
  function remove(item: Item) { persist(items.filter((x) => !(x.slug === item.slug && x.market === item.market))); }
  function clear() { localStorage.removeItem('diginanba-cart'); setItems([]); }
  const markets = [...new Set(items.map((x) => x.market))];
  const mixedMarket = markets.length > 1;
  const totalByMarket = useMemo(() => items.reduce((totals, item) => {
    totals[item.market] = (totals[item.market] || 0) + item.amountMinor * (item.quantity || 1);
    return totals;
  }, {} as Record<Market, number>), [items]);
  return <main className="wrap cart-page dn-cart-page">
    <div className="sectionhead"><div><div className="eyebrow">YOUR DIGINANBA</div><h1>Your cart</h1><p className="muted">Review products and quantities before checkout.</p></div><Link className="btn" href="/explore">Continue shopping</Link></div>
    {!ready ? <div className="panel">Loading your cart…</div> : !items.length ? <div className="panel dn-cart-empty"><div>🛍️</div><h2>Your cart is waiting for something useful</h2><p className="muted">Explore templates, guides, spreadsheets and digital tools built to help you get things done.</p><Link className="btn primary" href="/explore">Explore digital products →</Link></div> : <>
      {mixedMarket && <div className="dn-cart-warning" role="alert"><b>One currency per checkout</b><p>Your cart contains products from different storefronts. Remove items from other markets so every item uses the same currency before proceeding.</p><div>{markets.map((market) => <span key={market}>{marketName(market)}</span>)}</div></div>}
      <div className="dn-cart-layout"><section className="panel dn-cart-items"><div className="dn-cart-items-head"><b>{items.length} {items.length === 1 ? 'product' : 'products'}</b><button className="btn" type="button" onClick={clear}>Clear cart</button></div>
        {items.map((item) => {
          const fmt = new Intl.NumberFormat(locale(item.market), { style: 'currency', currency: currency(item.market) });
          return <article className="dn-cart-item" key={item.market + item.slug}><div className="dn-cart-product-mark">▦</div><div className="dn-cart-product-info"><span className="dn-cart-market">{marketName(item.market)}</span><h2>{item.title}</h2><span className="muted">{fmt.format(item.amountMinor / 100)} each</span><div className="dn-cart-quantity"><button type="button" aria-label={'Decrease quantity of ' + item.title} disabled={(item.quantity || 1) <= 1} onClick={() => changeQuantity(item, -1)}>−</button><span aria-live="polite">{item.quantity || 1}</span><button type="button" aria-label={'Increase quantity of ' + item.title} disabled={(item.quantity || 1) >= 10} onClick={() => changeQuantity(item, 1)}>+</button><button type="button" className="dn-cart-remove" onClick={() => remove(item)}>Remove</button></div></div><strong className="dn-cart-line-total">{fmt.format(item.amountMinor * (item.quantity || 1) / 100)}</strong></article>;
        })}
      </section><aside className="panel dn-cart-summary"><h2>Order summary</h2>{markets.map((market) => {const fmt = new Intl.NumberFormat(locale(market), {style:'currency',currency:currency(market)}); return <div className="dn-cart-total-line" key={market}><span>{marketName(market)}</span><b>{fmt.format((totalByMarket[market] || 0)/100)}</b></div>;})}<p className="muted dn-cart-tax-note">Final totals are recalculated from current published prices by the server. Taxes, if applicable, are shown when supported by checkout.</p><Link aria-disabled={mixedMarket} className={'btn primary dn-cart-checkout' + (mixedMarket ? ' disabled' : '')} href={mixedMarket ? '/cart' : '/checkout'} onClick={mixedMarket ? (e) => e.preventDefault() : undefined}>{mixedMarket ? 'Resolve market currencies first' : 'Proceed to checkout →'}</Link><Link className="dn-cart-continue" href="/explore">Continue shopping</Link></aside></div>
      <style>{`.dn-cart-page{padding-bottom:50px}.dn-cart-page .sectionhead{align-items:center;gap:16px}.dn-cart-page .sectionhead p{margin:7px 0 0}.dn-cart-empty{text-align:center;padding:42px 20px}.dn-cart-empty>div{font-size:38px}.dn-cart-empty h2{margin:10px 0}.dn-cart-warning{border:1px solid #e9bd66;background:#fff9e9;border-radius:14px;padding:16px 18px;margin:18px 0;color:#66440b}.dn-cart-warning p{font-size:13px;line-height:1.55;margin:5px 0 10px}.dn-cart-warning div{display:flex;gap:8px;flex-wrap:wrap}.dn-cart-warning span{font-size:11px;background:#fff;border:1px solid #f0dba9;border-radius:99px;padding:5px 9px}.dn-cart-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,.8fr);gap:18px;align-items:start;margin-top:18px}.dn-cart-items{padding:0 20px}.dn-cart-items-head{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid var(--border,#e6e8f0);font-size:13px}.dn-cart-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:14px;align-items:start;padding:20px 0;border-bottom:1px solid var(--border,#e6e8f0)}.dn-cart-item:last-child{border-bottom:0}.dn-cart-product-mark{width:44px;height:44px;border-radius:12px;background:#f0edff;color:#5144d5;display:grid;place-items:center;font-size:24px}.dn-cart-product-info{min-width:0}.dn-cart-market{font-size:10px;letter-spacing:.04em;color:#777f91;text-transform:uppercase}.dn-cart-product-info h2{font-size:15px;margin:5px 0 6px;overflow-wrap:anywhere}.dn-cart-product-info>.muted{font-size:12px}.dn-cart-line-total{font-size:14px;white-space:nowrap}.dn-cart-quantity{display:flex;align-items:center;gap:8px;margin-top:12px}.dn-cart-quantity button{min-width:29px;height:29px;border:1px solid var(--border,#dfe3ed);border-radius:8px;background:var(--surface,#fff);color:inherit;cursor:pointer}.dn-cart-quantity button:disabled{opacity:.4;cursor:default}.dn-cart-quantity span{min-width:16px;text-align:center;font-size:12px}.dn-cart-quantity .dn-cart-remove{border:0;background:transparent;color:#b42318;font-size:12px;width:auto;padding:0 4px}.dn-cart-summary{padding:20px;position:sticky;top:95px}.dn-cart-summary h2{font-size:18px;margin:0 0 16px}.dn-cart-total-line{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:12px 0;border-top:1px solid var(--border,#e6e8f0)}.dn-cart-total-line b{white-space:nowrap}.dn-cart-tax-note{font-size:11px;line-height:1.55;margin:12px 0}.dn-cart-checkout{display:block;text-align:center;width:100%;white-space:normal}.dn-cart-checkout.disabled{opacity:.55;cursor:not-allowed}.dn-cart-continue{display:block;text-align:center;font-size:12px;margin-top:14px;color:var(--foreground,#5144d5)}@media(max-width:760px){.dn-cart-layout{grid-template-columns:1fr}.dn-cart-summary{position:static;order:-1}.dn-cart-item{grid-template-columns:36px minmax(0,1fr)}.dn-cart-product-mark{width:36px;height:36px}.dn-cart-line-total{grid-column:2;justify-self:start}.dn-cart-page .sectionhead{align-items:flex-start;flex-direction:column}}@media(max-width:430px){.dn-cart-items{padding:0 13px}.dn-cart-item{gap:10px}.dn-cart-items-head{gap:10px}}`}</style>
    </>}
  </main>;
}
