'use client';

import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';

type ProviderInfo = { id: string; name: string };
const order = ['google', 'facebook', 'twitter', 'apple', 'microsoft-entra-id'];
const labels: Record<string, string> = {
  google: 'Continue with Google', facebook: 'Continue with Facebook', twitter: 'Continue with X',
  apple: 'Continue with Apple', 'microsoft-entra-id': 'Continue with Microsoft',
};
const marks: Record<string, string> = { google: 'G', facebook: 'f', twitter: '𝕏', apple: '', 'microsoft-entra-id': '▦' };

export default function SocialProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([{ id: 'google', name: 'Google' }]);
  const [loading, setLoading] = useState<string | null>(null);
  const [providerError, setProviderError] = useState('');

  useEffect(() => {
    getProviders().then((result) => {
      if (!result) return;
      const available = order.filter((id) => result[id]).map((id) => ({ id, name: result[id].name }));
      if (available.length) setProviders(available);
    }).catch(() => {
      // Keep the server-rendered Google option visible if provider discovery fails.
    });
  }, []);

  async function continueWith(providerId: string) {
    setLoading(providerId);
    setProviderError('');
    try {
      const result = await signIn(providerId, { callbackUrl: '/account', redirect: false });
      if (result?.error) setProviderError('Google sign-in is not available right now. Please try email sign-in or contact support.');
      else if (result?.url) window.location.assign(result.url);
    } catch {
      setProviderError('Unable to start social sign-in. Please try email sign-in.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="dn-social-login" aria-label="Social sign in">
      <div className="dn-social-heading">Continue with a social account</div>
      <div className="dn-social-grid">
        {providers.map((provider) => (
          <button key={provider.id} type="button" className="dn-social-button" onClick={() => continueWith(provider.id)} disabled={Boolean(loading)}>
            <span className={'dn-social-mark dn-social-mark-' + provider.id} aria-hidden="true">{marks[provider.id] || provider.name.slice(0, 1)}</span>
            <span>{labels[provider.id] || 'Continue with ' + provider.name}</span>
            {loading === provider.id && <span className="dn-social-loading">…</span>}
          </button>
        ))}
      </div>
      {providerError && <p className="dn-social-error" role="alert">{providerError}</p>}
    </section>
  );
}
