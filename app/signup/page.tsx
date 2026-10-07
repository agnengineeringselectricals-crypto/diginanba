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
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <a href="/" className="brand">DigiNanba</a>
        <h1>Create your account</h1>
        <p className="auth-intro">Join DigiNanba to save purchases, access downloads and manage your profile.</p>

        {error && <div className="error">{error}</div>}

        <SocialProviders />

        <div className="auth-divider"><span>or create with email</span></div>

        <div className="auth-form">
          <label>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoComplete="name" /></label>
          <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required autoComplete="email" /></label>
          <label>Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
          <button className="primary wide auth-submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </div>

        <div className="auth-foot">Already have an account? <a href="/login">Sign in</a></div>
      </form>
    </main>
  );
}
