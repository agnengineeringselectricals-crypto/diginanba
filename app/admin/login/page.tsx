'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (!result?.ok) {
      setError('Sign-in failed. Check your administrator credentials and try again.');
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <a href="/admin/login" className="brand">DigiNanba <span>Admin</span></a>
        <div className="eyebrow">PRIVATE ADMINISTRATION PORTAL</div>
        <h1>Administrator sign in</h1>
        <p>For authorized DigiNanba administrators and department staff only.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <label>
          Administrator email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
        </label>
        <button className="primary wide" disabled={loading}>{loading ? 'Signing in…' : 'Sign in to Admin'}</button>
        <p className="small muted">Access is checked against administrator roles after sign-in. A regular customer or creator account cannot open the admin dashboard.</p>
        <div className="auth-foot"><a href="https://diginanba.com">Return to DigiNanba marketplace</a></div>
      </form>
    </main>
  );
}
