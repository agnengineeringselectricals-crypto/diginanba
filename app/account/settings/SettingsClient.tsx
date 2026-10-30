'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import './settings.css';

type Preferences = {
  market: 'US' | 'UK' | 'IN'; language: string; emailOffers: boolean; productUpdates: boolean;
  wishlistAlerts: boolean; creatorUpdates: boolean; personalizedDiscovery: boolean;
  promotionEmails: boolean; rewardAlerts: boolean; referralUpdates: boolean; creatorNewsletter: boolean;
  saveSearchHistory: boolean; reducedMotion: boolean; compactCards: boolean;
};
const defaults: Preferences = { market: 'IN', language: 'English', emailOffers: false, productUpdates: true, wishlistAlerts: true, creatorUpdates: true, personalizedDiscovery: true, promotionEmails: false, rewardAlerts: true, referralUpdates: false, creatorNewsletter: false, saveSearchHistory: true, reducedMotion: false, compactCards: false };
const sections = [
  { id: 'preferences', icon: '🌐', label: 'Region & language' }, { id: 'promotions', icon: '🎁', label: 'Promotions & rewards' }, { id: 'accessibility', icon: '♿', label: 'Display & accessibility' },
  { id: 'account', icon: '👤', label: 'Account links' },
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const local = readPreferences();
      try {
        const response = await fetch('/api/account/preferences', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data.preferences) {
            const merged = { ...local, ...data.preferences } as Preferences;
            setPrefs(merged);
            localStorage.setItem('diginanba-user-preferences', JSON.stringify(merged));
            setReady(true);
            return;
          }
        }
      } catch { /* Keep the local copy available if the API is temporarily unavailable. */ }
      if (!cancelled) { setPrefs(local); setReady(true); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) { setPrefs((current) => ({ ...current, [key]: value })); setSaved(false); }
  async function save() {
    setSaving(true); setSaveError('');
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(data.error || 'Unable to save preferences. Please sign in again and retry.');
        setSaved(false);
        return;
      }
      localStorage.setItem('diginanba-user-preferences', JSON.stringify(prefs));
      localStorage.setItem('diginanba-market', prefs.market);
      localStorage.setItem('diginanba-language', prefs.language);
      localStorage.setItem('diginanba-email-updates', String(prefs.productUpdates || prefs.emailOffers));
      window.dispatchEvent(new CustomEvent('diginanba:preferences-updated', { detail: prefs }));
      setSaved(true);
    } catch {
      setSaveError('Could not reach the server. Your changes have not been saved to your account.');
      setSaved(false);
    } finally { setSaving(false); }
  }
  function reset() { setPrefs(defaults); setSaved(false); setSaveError(''); }
  const marketLabels = { US: 'United States · USD ($)', UK: 'United Kingdom · GBP (£)', IN: 'India · INR (₹)' };
  return <main className="dn-settings-page">
    <div className="dn-settings-topline"><Link href="/account">← My account</Link><span>Account preferences sync when saved</span></div>
    <header className="dn-settings-hero"><div><span className="dn-settings-eyebrow">YOUR DIGINANBA</span><h1>Settings</h1><p>Make your marketplace feel right for you. Manage your region, updates, privacy and how products are displayed.</p></div><div className="dn-settings-hero-mark" aria-hidden="true">⚙️</div></header>
    <div className="dn-settings-layout">
      <aside className="dn-settings-sidebar" aria-label="Settings sections"><p>SETTINGS MENU</p>{sections.map((section) => <button key={section.id} type="button" className={active === section.id ? 'active' : ''} onClick={() => { setActive(section.id); document.getElementById(section.id)?.scrollIntoView({ behavior: prefs.reducedMotion ? 'auto' : 'smooth', block: 'start' }); }}><span>{section.icon}</span>{section.label}<span className="dn-settings-chevron">›</span></button>)}</aside>
      <div className="dn-settings-content">
        <section className="dn-settings-section" id="preferences"><div className="dn-settings-section-head"><span>🌍</span><div><h2>Region & language</h2><p>Choose the storefront and language you prefer. Availability of translated products may vary.</p></div></div><div className="dn-settings-fields">
          <label>Storefront region <select value={prefs.market} onChange={(e) => update('market', e.target.value as Preferences['market'])}><option value="IN">{marketLabels.IN}</option><option value="US">{marketLabels.US}</option><option value="UK">{marketLabels.UK}</option></select><small>Prices and checkout currency can depend on the selected storefront.</small></label>
          <label>Preferred language <select value={prefs.language} onChange={(e) => update('language', e.target.value)}>{['English','हिन्दी','தமிழ்','తెలుగు','বাংলা','मराठी','ગુજરાતી','ಕನ್ನಡ','മലയാളം','Español','Français','Deutsch','Português','العربية','日本語','中文'].map((language) => <option key={language}>{language}</option>)}</select><small>This preference is saved locally. Full site translation is not yet available for every language.</small></label>
        </div></section>


        <section className="dn-settings-section" id="promotions"><div className="dn-settings-section-head"><span>🎁</span><div><h2>Promotions & rewards</h2><p>Choose optional offers and reward updates. Important account, security, order and payment messages remain separate from marketing preferences.</p></div></div><div className="dn-settings-options">
          <label className="dn-settings-toggle"><span><b>Promotional emails</b><small>Optional campaigns, discounts and curated product offers.</small></span><input type="checkbox" checked={prefs.promotionEmails} onChange={(e) => update('promotionEmails', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Rewards activity alerts</b><small>Updates about eligible points, pending rewards, expiry and reversals when the rewards programme is available.</small></span><input type="checkbox" checked={prefs.rewardAlerts} onChange={(e) => update('rewardAlerts', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Referral programme updates</b><small>Information about referral eligibility and attributed activity, subject to published programme terms.</small></span><input type="checkbox" checked={prefs.referralUpdates} onChange={(e) => update('referralUpdates', e.target.checked)} /></label>
          <label className="dn-settings-toggle"><span><b>Creator newsletter</b><small>Optional tips and announcements for people interested in publishing digital products.</small></span><input type="checkbox" checked={prefs.creatorNewsletter} onChange={(e) => update('creatorNewsletter', e.target.checked)} /></label>
          <p style={{fontSize:13,color:'var(--muted, #64748b)'}}>Your optional marketing choices are recorded with a consent-change history. Saving preferences does not enrol you in a rewards programme or activate campaigns. Reward and referral benefits remain subject to published programme terms.</p>
        </div></section>
        <section className="dn-settings-section" id="accessibility"><div className="dn-settings-section-head"><span>♿</span><div><h2>Display & accessibility</h2><p>Choose how the interface responds to motion.</p></div></div><div className="dn-settings-options">
          <label className="dn-settings-toggle"><span><b>Reduce motion</b><small>Prefer reduced animations where the interface supports this setting.</small></span><input type="checkbox" checked={prefs.reducedMotion} onChange={(e) => update('reducedMotion', e.target.checked)} /></label>

        </div></section>
        <section className="dn-settings-section" id="account"><div className="dn-settings-section-head"><span>🔐</span><div><h2>Account & security</h2><p>Shortcuts to your account, purchases and creator tools.</p></div></div><div className="dn-settings-account-links">
          <Link href="/account"><span>👤</span><div><b>Account overview</b><small>Open your personal dashboard</small></div><span>›</span></Link>
          <Link href="/account/security"><span>🔐</span><div><b>Security & sign-in activity</b><small>View your permanent account ID and recent sign-ins</small></div><span>›</span></Link>
          <Link href="/account/library"><span>📚</span><div><b>My digital library</b><small>Find your purchased resources</small></div><span>›</span></Link>
          <Link href="/account/orders"><span>🧾</span><div><b>Orders & purchases</b><small>Review order history and status</small></div><span>›</span></Link>
          <Link href="/seller/studio"><span>🛍️</span><div><b>Creator Studio</b><small>Create and manage product drafts</small></div><span>›</span></Link>
        </div></section>
        <div className="dn-settings-savebar"><span role="status">{saveError || (saved ? '✓ Preferences saved to your account' : ready ? 'Unsaved changes — save to sync across devices.' : 'Loading your preferences…')}</span><div><button type="button" className="dn-settings-reset" onClick={reset} disabled={!ready || saving}>Reset defaults</button><button type="button" className="dn-settings-save" onClick={save} disabled={!ready || saving}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save preferences'}</button></div></div>
      </div>
    </div>
  </main>;
}
