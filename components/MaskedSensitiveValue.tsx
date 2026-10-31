'use client';

import { useState } from 'react';

export default function MaskedSensitiveValue({ value, kind, label }: { value: string; kind: 'email' | 'id'; label: string }) {
  const [visible, setVisible] = useState(false);
  const masked = kind === 'id'
    ? (value.length > 4 ? value.slice(0, 2) + '•'.repeat(Math.max(4, value.length - 4)) + value.slice(-2) : '••••')
    : (() => {
        const [local, domain] = value.split('@');
        if (!domain) return '••••••';
        return (local.slice(0, 1) || '•') + '•'.repeat(Math.max(4, local.length - 1)) + '@' + domain;
      })();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
      <span aria-label={visible ? label : label + ' masked'}>{visible ? value : masked}</span>
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide ' + label : 'Show ' + label}
        title={visible ? 'Hide' : 'Show'}
        style={{ border: 0, background: 'transparent', color: '#5144d5', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1.1-1.3 2.4-2.6 3.5" />
            <path d="M6.2 6.2C3.9 7.7 2.7 9.8 2.5 12c.7 2.1 4.2 7 9.5 7 1.2 0 2.3-.2 3.3-.7" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
