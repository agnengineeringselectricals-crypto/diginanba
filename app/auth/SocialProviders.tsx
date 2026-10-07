'use client';

import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';

type ProviderInfo = { id: string; name: string };

const order = ['google', 'facebook', 'twitter', 'apple', 'microsoft-entra-id'];

const labels: Record<string, string> = {
  google: 'Continue with Google',
  facebook: 'Continue with Facebook',
  twitter: 'Continue with X',
  apple: 'Continue with Apple',
  'microsoft-entra-id': 'Continue with Microsoft',
};

const marks: Record<string, string> = {
  google: 'G',
  facebook: 'f',
  twitter: '𝕏',
  apple: '',
  'microsoft-entra-id': '▦',
};

export default function SocialProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    getProviders().then((result) => {
      if (!result) return;
      setProviders(
        order
          .filter((id) => result[id])
          .map((id) => ({ id, name: result[id].name }))
      );
    });
  }, []);

  if (!providers.length) return null;

  async function continueWith(providerId: string) {
    setLoading(providerId);
    await signIn(providerId, { callbackUrl: '/account' });
  }

  return (
    <section className="social-login" aria-label="Social sign in">
      <div className="social-divider"><span>or continue with</span></div>
      <div className="social-grid">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className="social-button"
            onClick={() => continueWith(provider.id)}
            disabled={Boolean(loading)}
          >
            <span className="social-mark" aria-hidden="true">{marks[provider.id]}</span>
            <span>{labels[provider.id] || 'Continue with ' + provider.name}</span>
            {loading === provider.id && <span className="social-loading">…</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
