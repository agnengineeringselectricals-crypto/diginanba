'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
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
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!result?.ok) {
        setError('Sign-in failed. Check your email and password, then try again.');
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <Link href="/" className="brand">DigiNanba</Link>
        <span className="eyebrow">PRIVATE ADMINISTRATION</span>
        <h1>Admin sign in</h1>
        <p>Sign in with your existing DigiNanba administrator account. Access is granted only to accounts assigned an administrator role.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
        </label>
        <button className="primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in to Admin'}
        </button>
        <div className="auth-foot"><Link href="/login">Go to customer sign in</Link></div>
      </form>
    </main>
  );
}
