'use client';

import { useState } from 'react';

export default function InviteShopOwner() {
  const [link,setLink] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  async function create() {
    setBusy(true); setMessage(''); setLink('');
    try {
      const response = await fetch('/api/marketplace/invitations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({direction:'customer_to_owner',channel:'link'})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create invitation.');
      setLink(window.location.origin + data.invitationPath);
      setMessage('Your invitation is ready. Send it to the shop owner.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create invitation.'); }
    finally { setBusy(false); }
  }
  const shareText = 'I would like to connect with your shop on DigiNanba. Join or sign in, register your shop, and accept my invitation: ' + link;
  return <main style={{maxWidth:720,margin:'0 auto',padding:'36px 18px 70px',color:'#172033'}}>
    <a href="/account" style={{color:'#176b4d'}}>← My account</a>
    <h1 style={{fontSize:30,marginBottom:8}}>Invite a Shop Owner</h1>
    <p style={{color:'#667085'}}>Invite a local shop owner to join DigiNanba. After the owner registers their shop and accepts your invitation, your customer connection will appear in their CRM list.</p>
    <section style={{padding:20,border:'1px solid #e4e7ec',borderRadius:16,display:'grid',gap:12}}>
      <div style={{fontSize:34}}>🏪</div>
      <strong>How it works</strong>
      <ol style={{color:'#475467',lineHeight:1.8,paddingLeft:22,margin:0}}>
        <li>Create your personal invitation link.</li>
        <li>Share it through WhatsApp, SMS or any messaging app.</li>
        <li>The shop owner creates a DigiNanba account or signs in.</li>
        <li>The owner registers a shop and opens your invitation again.</li>
        <li>Your name appears in the shop owner's customer CRM.</li>
      </ol>
      <button type="button" disabled={busy} onClick={create} style={{border:0,borderRadius:999,padding:13,background:'#176b4d',color:'#fff',fontWeight:750,cursor:'pointer'}}>{busy?'Creating invitation…':'Create invitation link'}</button>
      {message && <p role="status" style={{margin:0,color:'#475467'}}>{message}</p>}
      {link && <><div style={{padding:12,background:'#f8fafc',borderRadius:10,overflowWrap:'anywhere',fontSize:13}}>{link}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>navigator.clipboard.writeText(link)} style={{border:0,borderRadius:999,padding:'10px 14px',background:'#176b4d',color:'#fff',fontWeight:700}}>Copy link</button><a target="_blank" rel="noreferrer" href={'https://wa.me/?text='+encodeURIComponent(shareText)} style={{borderRadius:999,padding:'10px 14px',background:'#176b4d',color:'#fff',textDecoration:'none',fontWeight:700}}>WhatsApp</a><a href={'sms:?body='+encodeURIComponent(shareText)} style={{borderRadius:999,padding:'10px 14px',background:'#eef2f6',color:'#172033',textDecoration:'none',fontWeight:700}}>SMS</a></div></>}
    </section>
    <p style={{fontSize:12,color:'#667085',marginTop:14}}>Invitation links expire after 30 days. The shop owner must accept the invitation. This connection does not authorize promotional messages.</p>
  </main>;
}
