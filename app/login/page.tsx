'use client';

import { FormEvent, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SocialProviders from '../auth/SocialProviders';

const socialMessages: Record<string, string> = {
  AccountAlreadyExists: 'An account with this email already exists. Sign in with your email and password first; we will add secure account linking later.',
  AccountDisabled: 'This account is currently unavailable. Please contact DigiNanba support.',
  SocialAccountNeedsEmail: 'This social account did not provide an email address, so DigiNanba cannot create the customer account.',
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code && socialMessages[code]) setError(socialMessages[code]);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (!result?.ok) return setError('Email or password is incorrect.');
    router.push('/account');
    router.refresh();
  }

  return (
    <main className="dn-auth-page">
      <header className="dn-auth-header">
        <a href="/" className="dn-auth-logo">Digi<span>Nanba</span></a>
        <span className="dn-auth-global">🌐 Global digital marketplace</span>
        <a href="/signup" className="dn-auth-header-link">Create account</a>
      </header>
      <section className="dn-auth-layout">
        <div className="dn-auth-form-panel">
          <a href="/" className="dn-auth-back">← Back to marketplace</a>
          <div className="dn-auth-eyebrow">YOUR DIGITAL WORLD, ALL IN ONE PLACE</div>
          <h1>Welcome back <span>👋</span></h1>
          <p className="dn-auth-subtitle">Sign in to discover your purchases, downloads and saved digital products.</p>
          {error && <div className="error">{error}</div>}
          <SocialProviders />
          <div className="dn-auth-or"><span>or sign in with email</span></div>
          <form className="dn-auth-fields" onSubmit={submit}>
            <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" /></label>
            <button className="dn-auth-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="dn-auth-switch">New to DigiNanba? <a href="/signup">Create an account</a></p>
          <p className="dn-auth-secure">🔒 Your account and purchases are protected.</p>
        </div>
        <aside className="dn-auth-visual">
          <div className="dn-auth-visual-glow" />
          <div className="dn-auth-visual-content">
            <div className="dn-auth-orbit">✦</div>
            <div className="dn-auth-visual-kicker">ONE MARKETPLACE. ENDLESS POSSIBILITIES.</div>
            <h2>Discover.<br />Download.<br /><span>Create. Grow.</span></h2>
            <p>Ideas, tools and digital resources to help you do more — wherever you are in the world.</p>
            <div className="dn-auth-visual-tags"><span>📚 Ebooks</span><span>📊 Templates</span><span>🎨 Creative tools</span><span>💡 Guides</span></div>
          </div>
          <div className="dn-auth-floating dn-auth-float-one">📈 <span>Grow your skills</span></div>
          <div className="dn-auth-floating dn-auth-float-two">✨ <span>Ideas into action</span></div>
        </aside>
      </section>
      <footer className="dn-auth-footer">© {new Date().getFullYear()} DigiNanba <span>·</span> Global digital products marketplace <span>·</span> <a href="/">Back to marketplace</a></footer>
    </main>
  );
}
