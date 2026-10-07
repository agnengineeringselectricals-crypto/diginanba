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
    <main className="global-auth-page">
      <header className="global-auth-header">
        <a href="/" className="global-auth-logo">Digi<span>Nanba</span></a>
        <div className="global-auth-market">🌐 Global marketplace</div>
        <a href="/signup" className="global-auth-top-link">Create account</a>
      </header>

      <section className="global-auth-main">
        <div className="global-auth-card">
          <div className="global-auth-kicker">WELCOME BACK</div>
          <h1>Sign in to DigiNanba</h1>
          <p className="global-auth-intro">Access your purchases, downloads, saved products and account settings.</p>

          {error && <div className="error">{error}</div>}

          <SocialProviders />

          <div className="global-auth-divider"><span>or sign in with email</span></div>

          <form className="global-auth-form" onSubmit={submit}>
            <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" /></label>
            <button className="global-auth-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <p className="global-auth-foot">New to DigiNanba? <a href="/signup">Create an account</a></p>
        </div>
      </section>

      <footer className="global-auth-footer">© {new Date().getFullYear()} DigiNanba · Global digital products marketplace · <a href="/">Back to marketplace</a></footer>
    </main>
  );
}
