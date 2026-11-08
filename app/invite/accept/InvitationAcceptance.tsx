'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function InvitationAcceptance() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState('Checking your invitation…');
  const [error, setError] = useState('');
  useEffect(() => {
    const token = params.get('token') || '';
    if (!token) { setError('This invitation link is incomplete.'); setMessage(''); return; }
    let active = true;
    fetch('/api/marketplace/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to accept invitation.');
      if (!active) return;
      setMessage(data.message || 'Invitation accepted. Redirecting to your dashboard…');
      router.replace(data.redirectTo || '/account');
      router.refresh();
    }).catch(reason => {
      if (active) { setError(reason instanceof Error ? reason.message : 'Unable to accept invitation.'); setMessage(''); }
    });
    return () => { active = false; };
  }, [params, router]);
  return <main style={{maxWidth:560,margin:'12vh auto',padding:24,textAlign:'center',fontFamily:'inherit'}}>
    <div style={{fontSize:42,marginBottom:12}}>🤝</div>
    <h1>Connect on DigiNanba</h1>
    {message && <p role="status" style={{color:'#176b4d'}}>{message}</p>}
    {error && <><p role="alert" style={{color:'#b42318'}}>{error}</p><a href="/account">Go to my account</a></>}
  </main>;
}
