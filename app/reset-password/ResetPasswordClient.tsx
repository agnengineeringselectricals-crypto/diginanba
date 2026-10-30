'use client';

import { FormEvent, useState } from 'react';

export default function ResetPasswordClient({ token = '' }: { token?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unregisteredEmail, setUnregisteredEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const hasToken = Boolean(token);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setUnregisteredEmail(false);

    if (hasToken && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        hasToken ? '/api/auth/password-reset/confirm' : '/api/auth/password-reset/request',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hasToken ? { token, password } : { email }),
        },
      );
      const result = await response.json();
      if (!hasToken && result.unregistered === true) {
        setError(result.error || 'This email address is not registered with DigiNanba.');
        setUnregisteredEmail(true);
      } else if (!response.ok) {
        setError(result.error || 'Unable to complete the request. Please try again.');
      } else if (!hasToken) {
        setEmailSent(true);
        setEmail('');
      } else {
        setMessage(result.message || 'Your password has been updated successfully.');
        setPassword('');
        setConfirmPassword('');
      }
    } catch {
      setError('Connection problem. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-topline"><a href="/" className="auth-home-link auth-home-inside" aria-label="Go to DigiNanba home"><span aria-hidden="true">⌂</span> Home</a><span className="auth-tagline">Create · Earn &amp; Grow</span></div><a href="/" className="brand auth-brand-beautiful">Digi<span>Nanba</span></a>
        {emailSent && !hasToken ? (
          <section className="reset-email-confirmation" role="status" aria-live="polite">
            <h1>Check your email</h1>
            <p>Your password reset link has been sent. Open your inbox and follow the link in the message to reset your DigiNanba password.</p>
            <a
              className="primary reset-go-to-mail"
              href="https://mail.google.com/mail/u/0/#inbox"
              target="_blank"
              rel="noopener noreferrer"
            >
              Go to mail
            </a>
            <p className="auth-foot">If your email provider asks you to sign in, complete that step to open your inbox. If you use a different email provider, open its mail app or website.</p>
            <div className="auth-foot"><a href="/login">Back to sign in</a></div>
          </section>
        ) : (
          <>
            <h1 className="reset-page-title">{hasToken ? 'Choose a new password' : 'Reset your password'}</h1>
            {hasToken && <p>Choose a strong password with at least 8 characters.</p>}
            {error && <div className="error" role="alert">{error}</div>}
            {message && <div className="success" role="status">{message}</div>}
            {hasToken ? (
              <>
                <label>New password
                  <input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
                </label>
                <label>Confirm new password
                  <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
                </label>
              </>
            ) : (
              <label>Email
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="email" />
              </label>
            )}
            <button className="primary" disabled={loading}>{loading ? 'Please wait…' : hasToken ? 'Update password' : 'Send reset link'}</button>
            {unregisteredEmail && (
              <div className="auth-foot">
                <a href="/signup">Create a new account</a>
                <span> · </span>
                <a href="/reset-password">Enter a different email</a>
              </div>
            )}
            {!unregisteredEmail && <div className="auth-foot"><a href="/login">Back to sign in</a></div>}
          </>
        )}
      </form>
    </main>
  );
}
