'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SocialProviders from '../auth/SocialProviders';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const r = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await r.json();
    if (!r.ok) { setLoading(false); setError(data.error || 'Unable to create account.'); return; }
    const login = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
    setLoading(false);
    if (!login?.ok) { router.push('/login'); return; }
    router.push('/account');
    router.refresh();
  }

  return (
    <main className="dn-auth-page">
      <header className="dn-auth-header">
        <a href="/" className="dn-auth-logo">Digi<span>Nanba</span></a>
        <span className="dn-auth-global">🌐 Global digital marketplace</span>
        <a href="/login" className="dn-auth-header-link">Sign in</a>
      </header>
      <section className="dn-auth-layout">
        <div className="dn-auth-form-panel">
          <a href="/" className="dn-auth-back">← Back to marketplace</a>
          <div className="dn-auth-eyebrow">JOIN THE GLOBAL MARKETPLACE</div>
          <h1>Create your account <span>✨</span></h1>
          <p className="dn-auth-subtitle">One account to discover, purchase and securely access digital products worldwide.</p>
          {error && <div className="error">{error}</div>}
          <SocialProviders />
          <div className="dn-auth-or"><span>or sign up with email</span></div>
          <form className="dn-auth-fields" onSubmit={submit}>
            <label>Your name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoComplete="name" placeholder="Your name" /></label>
            <label>Email address<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label>
            <button className="dn-auth-submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
          </form>
          <p className="dn-auth-switch">Already have an account? <a href="/login">Sign in</a></p>
          <p className="dn-auth-secure">🔒 Your account and purchases are protected.</p>
        </div>
        <aside className="dn-auth-visual">
          <div className="dn-auth-visual-glow" />
          <div className="dn-auth-visual-content">
            <div className="dn-auth-orbit">✦</div>
            <div className="dn-auth-visual-kicker">YOUR NEXT BIG IDEA STARTS HERE</div>
            <h2>Discover.<br />Download.<br /><span>Create. Grow.</span></h2>
            <p>Explore ebooks, business tools, templates and creative resources from a world of digital ideas.</p>
            <div className="dn-auth-visual-tags"><span>📚 Ebooks</span><span>📊 Templates</span><span>🎨 Creative tools</span><span>💡 Guides</span></div>
          </div>
          <div className="dn-auth-floating dn-auth-float-one">🌍 <span>Made for the world</span></div>
          <div className="dn-auth-floating dn-auth-float-two">⚡ <span>Instant digital access</span></div>
        </aside>
      </section>
      <footer className="dn-auth-footer">© {new Date().getFullYear()} DigiNanba <span>·</span> Global digital products marketplace <span>·</span> <a href="/">Back to marketplace</a></footer>
    </main>
  );
}
