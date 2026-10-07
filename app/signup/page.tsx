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
    const r = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await r.json();
    if (!r.ok) {
      setLoading(false);
      setError(data.error || 'Unable to create account.');
      return;
    }
    const login = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
    setLoading(false);
    if (!login?.ok) {
      router.push('/login');
      return;
    }
    router.push('/account');
    router.refresh();
  }

  return (
    <main className="global-auth-page">
      <header className="global-auth-header">
        <a href="/" className="global-auth-logo">Digi<span>Nanba</span></a>
        <div className="global-auth-market">🌐 Global marketplace</div>
        <a href="/login" className="global-auth-top-link">Sign in</a>
      </header>

      <section className="global-auth-main">
        <div className="global-auth-card">
          <div className="global-auth-kicker">JOIN THE MARKETPLACE</div>
          <h1>Create your DigiNanba account</h1>
          <p className="global-auth-intro">Create one account to discover, purchase and securely access digital products worldwide.</p>

          {error && <div className="error">{error}</div>}

          <SocialProviders />

          <div className="global-auth-divider"><span>or create with email</span></div>

          <form className="global-auth-form" onSubmit={submit}>
            <label>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoComplete="name" placeholder="Your name" /></label>
            <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label>
            <button className="global-auth-primary" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </form>

          <p className="global-auth-foot">Already have an account? <a href="/login">Sign in</a></p>
        </div>
      </section>

      <footer className="global-auth-footer">© {new Date().getFullYear()} DigiNanba · Global digital products marketplace · <a href="/">Back to marketplace</a></footer>
    </main>
  );
}
