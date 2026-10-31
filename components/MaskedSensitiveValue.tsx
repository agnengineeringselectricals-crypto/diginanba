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
  return <span style={{display:'inline-flex',alignItems:'center',gap:9,flexWrap:'wrap'}}>
    <span aria-label={visible ? label : label + ' masked'}>{visible ? value : masked}</span>
    <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide ' + label : 'Show ' + label} title={visible ? 'Hide' : 'Show'} style={{border:0,background:'transparent',color:'#5144d5',cursor:'pointer',fontSize:18,lineHeight:1,padding:4}}>
      {visible ? '◉' : '◎'}
    </button>
  </span>;
}
