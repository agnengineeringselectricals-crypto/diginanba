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
    <>
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
      <style jsx global>{`
        .social-login{margin:20px 0}
        .social-divider{display:flex;align-items:center;gap:12px;color:#7a8293;font-size:12px;font-weight:700;margin:18px 0}
        .social-divider:before,.social-divider:after{content:"";height:1px;background:#e7e8ee;flex:1}
        .social-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .social-button{position:relative;display:flex;align-items:center;justify-content:center;gap:9px;min-height:46px;border:1px solid #dfe2ea;border-radius:11px;background:#fff;color:#202638;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:.15s}
        .social-button:hover:not(:disabled){border-color:#b9b1ff;background:#faf9ff;transform:translateY(-1px)}
        .social-button:disabled{opacity:.65;cursor:wait}
        .social-mark{display:grid;place-items:center;width:22px;height:22px;font-size:17px;font-weight:900}
        .social-loading{position:absolute;right:12px}
        @media(max-width:520px){.social-grid{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
