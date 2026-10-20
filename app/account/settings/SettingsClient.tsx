'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import './settings.css';

type Preferences = {
  market: 'US' | 'UK' | 'IN'; language: string; emailOffers: boolean; productUpdates: boolean;
  wishlistAlerts: boolean; creatorUpdates: boolean; personalizedDiscovery: boolean;
  saveSearchHistory: boolean; reducedMotion: boolean; compactCards: boolean;
};
const defaults: Preferences = { market: 'IN', language: 'English', emailOffers: false, productUpdates: true, wishlistAlerts: true, creatorUpdates: true, personalizedDiscovery: true, saveSearchHistory: true, reducedMotion: false, compactCards: false };
const sections = [
  { id: 'preferences', icon: '🌐', label: 'Region & language' }, { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'discovery', icon: '✨', label: 'Discovery & privacy' }, { id: 'accessibility', icon: '♿', label: 'Display & accessibility' },
  { id: 'account', icon: '🔐', label: 'Account & security' },
];
function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem('diginanba-user-preferences') || '{}');
    const oldMarket = localStorage.getItem('diginanba-market');
    return { ...defaults, ...saved, market: saved.market || (oldMarket === 'US' || oldMarket === 'UK' || oldMarket === 'IN' ? oldMarket : defaults.market), language: saved.language || localStorage.getItem('diginanba-language') || defaults.language };
  } catch { return defaults; }
}
export default function SettingsClient() {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [active, setActive] = useState('preferences');
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setPrefs(readPreferences()); setReady(true); }, []);
  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) { setPrefs((current) => ({ ...current, [key]: value })); setSaved(false); }
  function save() {
    localStorage.setItem('diginanba-user-preferences', JSON.stringify(prefs));
    localStorage.setItem('diginanba-market', prefs.market); localStorage.setItem('diginanba-language', prefs.language);
    localStorage.setItem('diginanba-email-updates', String(prefs.productUpdates || prefs.emailOffers));
    window.dispatchEvent(new CustomEvent('diginanba:preferences-updated', { detail: prefs })); setSaved(true);
  }
  function reset() { setPrefs(defaults); localStorage.setItem('diginanba-user-preferences', JSON.stringify(defaults)); localStorage.setItem('diginanba-market', defaults.market); localStorage.setItem('diginanba-language', defaults.language); setSaved(true); }
  const marketLabels = { US: 'United States · USD ($)', UK: 'United Kingdom · GBP (£)', IN: 'India · INR (₹)' };
  return <main className="dn-settings-page">
    <div className="dn-settings-topline"><Link href="/account">← My account</Link><span>Preferences are saved on this device</span></div>
    <header className="dn-settings-hero"><div><span className="dn-settings-eyebrow">YOUR DIGINANBA</span><h1>Settings</h1><p>Make your marketplace feel right for you. Manage your region, updates, privacy and how products are displayed.</p></div><div className="dn-settings-hero-mark" aria-hidden="true">⚙️</div></header>
    <div className="dn-settings-layout">
      <aside className="dn-settings-sidebar" aria-label="Settings sections"><p>SETTINGS MENU</p>{sections.map((section) => <button key={section.id} type="button" className={active === section.id ? 'active' : ''} onClick={() => { setActive(section.id); document.getElementById(section.id)?.scrollIntoView({ behavior: prefs.reducedMotion ? 'auto' : 'smooth', block: 'start' }); }}><span>{section.icon}</span>{section.label}<span className="dn-settings-chevron">›</span></button>)}<div className="dn-settings-help"><b>Need a hand?</b><p>Visit the marketplace to discover tools or return to your account overview.</p><Link href="/explore">Explore products →</Link></div></aside>
      <div className="dn-settings-content">
        <section className="dn-settings-section" id="preferences"><div className="dn-settings-section-head"><span>🌍</span><div><h2>Region & language</h2><p>Choose the storefront and language you prefer. Availability of translated products may vary.</p></div></div><div className="dn-settings-fields">
          <label>Storefront region <select value={prefs.market} onChange={(e) => update('market', e.target.value as Preferences['market'])}><option value="IN">{marketLabels.IN}</option><option value="US">{marketLabels.US}</option><option value="UK">{marketLabels.UK}</option></select><small>Prices and checkout currency can depend on the selected storefront.</small></label>
          <label>Preferred language <select value={prefs.language} onChange={(e) => update('language', e.target.value)}>{['English','हिन्दी','தமிழ்','తెలుగు','বাংলা','मराठी','ગુજરાતી','ಕನ್ನಡ','മലയാളം','Español','Français','Deutsch','Português','العربية','日本語','中文'].map((language) => <option key={language}>{language}</option>)}</select><small>This preference is saved locally. Full site translation is not yet available for every language.</small></label>
        </div></section>
        <section className="dn-settings-section" id="notifications"><div className="dn-settings-section-head"><span>🔔</span><div><h2>Notifications</h2><p>Choose the kinds of updates you would like DigiNanba to remember as your preferences.</p></div></div><div className="dn-settings-options">
          <label className="dn-settings-toggle"><span><b>Product updates & new releases</b><small>Updates about products and improvements you may find useful.</small></span><input type="checkbox" checked={prefs.productUpdates} onChange={(e) => update('productUpdates', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Offers and marketplace news</b><small>Promotions, curated collections and occasional announcements.</small></span><input type="checkbox" checked={prefs.emailOffers} onChange={(e) => update('emailOffers', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Wishlist reminders</b><small>Remember that you are interested in saved products.</small></span><input type="checkbox" checked={prefs.wishlistAlerts} onChange={(e) => update('wishlistAlerts', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Creator and earnings updates</b><small>Relevant creator studio and marketplace notices.</small></span><input type="checkbox" checked={prefs.creatorUpdates} onChange={(e) => update('creatorUpdates', e.target.checked)} /></label>
        </div><p className="dn-settings-note">These are preference controls only; email delivery and notification services may not yet be enabled.</p></section>
        <section className="dn-settings-section" id="discovery"><div className="dn-settings-section-head"><span>✨</span><div><h2>Discovery & privacy</h2><p>Set how DigiNanba should personalize discovery on this device.</p></div></div><div className="dn-settings-options">
          <label className="dn-settings-toggle"><span><b>Personalized product discovery</b><small>Allow the interface to use your selected preferences to tailor discovery when supported.</small></span><input type="checkbox" checked={prefs.personalizedDiscovery} onChange={(e) => update('personalizedDiscovery', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Remember recent searches on this device</b><small>Preference for future search-history features. Search-demand analytics currently records searches separately.</small></span><input type="checkbox" checked={prefs.saveSearchHistory} onChange={(e) => update('saveSearchHistory', e.target.checked)} /></label>
        </div><div className="dn-settings-inline-links"><Link href="/account/wishlist">Manage wishlist →</Link><Link href="/account/orders">View purchase history →</Link></div></section>
        <section className="dn-settings-section" id="accessibility"><div className="dn-settings-section-head"><span>♿</span><div><h2>Display & accessibility</h2><p>Choose a calmer or more compact browsing experience.</p></div></div><div className="dn-settings-options">
          <label className="dn-settings-toggle"><span><b>Reduce motion</b><small>Prefer reduced animations where the interface supports this setting.</small></span><input type="checkbox" checked={prefs.reducedMotion} onChange={(e) => update('reducedMotion', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Compact product cards</b><small>Save this preference for compact product layouts as they become available.</small></span><input type="checkbox" checked={prefs.compactCards} onChange={(e) => update('compactCards', e.target.checked)} /></label>
        </div></section>
        <section className="dn-settings-section" id="account"><div className="dn-settings-section-head"><span>🔐</span><div><h2>Account & security</h2><p>Shortcuts to your account, purchases and creator tools.</p></div></div><div className="dn-settings-account-links">
          <Link href="/account"><span>👤</span><div><b>Account overview</b><small>Open your personal dashboard</small></div><span>›</span></Link>
          <Link href="/account/library"><span>📚</span><div><b>My digital library</b><small>Find your purchased resources</small></div><span>›</span></Link>
          <Link href="/account/orders"><span>🧾</span><div><b>Orders & purchases</b><small>Review order history and status</small></div><span>›</span></Link>
          <Link href="/seller/studio"><span>🛍️</span><div><b>Creator Studio</b><small>Create and manage product drafts</small></div><span>›</span></Link>
        </div><p className="dn-settings-note">Password changes, account deletion and security-device management are not offered here yet. No security controls are simulated.</p></section>
        <div className="dn-settings-savebar"><span role="status">{saved ? '✓ Preferences saved on this device' : ready ? 'Unsaved changes stay here until you save.' : 'Loading your preferences…'}</span><div><button type="button" className="dn-settings-reset" onClick={reset}>Reset defaults</button><button type="button" className="dn-settings-save" onClick={save} disabled={!ready}>{saved ? 'Saved ✓' : 'Save preferences'}</button></div></div>
      </div>
    </div>
  </main>;
}
