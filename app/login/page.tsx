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
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <a href="/" className="brand">DigiNanba</a>
        <h1>Welcome back</h1>
        <p className="auth-intro">Sign in to access your DigiNanba account, purchases and downloads.</p>

        {error && <div className="error">{error}</div>}

        <SocialProviders />

        <div className="auth-divider"><span>or sign in with email</span></div>

        <div className="auth-form">
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
          <button className="primary wide auth-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <div className="auth-foot">New to DigiNanba? <a href="/signup">Create an account</a></div>
      </form>
    </main>
  );
}
