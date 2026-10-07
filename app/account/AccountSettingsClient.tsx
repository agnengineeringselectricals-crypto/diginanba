'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';

type Profile={id:string;email:string;display_name:string|null;status:string;created_at:string};

export function ProfileForm({initial}:{initial:Profile}){
 const [name,setName]=useState(initial.display_name||'');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/account/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({displayName:name})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage('Your name was updated.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to save changes.')}finally{setBusy(false)}}
 return <form className="account-form" onSubmit={save}><label>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label><label>Email address<input value={initial.email} readOnly/></label><button className="account-primary" disabled={busy}>{busy?'Saving…':'Save changes'}</button>{message&&<p className="account-form-message">{message}</p>}</form>;
}

export function SecurityForm({hasPassword}:{hasPassword:boolean}){
 const [current,setCurrent]=useState('');const [next,setNext]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 if(!hasPassword)return <div className="account-info-box"><strong>Social sign-in account</strong><p>This account does not use a DigiNanba password. Continue using your linked social sign-in provider.</p></div>;
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/account/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({currentPassword:current,newPassword:next})});const d=await r.json();if(!r.ok)throw new Error(d.error);setCurrent('');setNext('');setMessage('Password changed successfully.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to change password.')}finally{setBusy(false)}}
 return <form className="account-form" onSubmit={save}><label>Current password<input type="password" value={current} onChange={e=>setCurrent(e.target.value)} autoComplete="current-password"/></label><label>New password<input type="password" value={next} onChange={e=>setNext(e.target.value)} minLength={8} autoComplete="new-password"/></label><button className="account-primary" disabled={busy}>{busy?'Updating…':'Change password'}</button>{message&&<p className="account-form-message">{message}</p>}</form>;
}

const preferenceKey='diginanba-account-preferences';
type Pref={market:'US'|'UK';language:'en-US'|'en-GB';orderUpdates:boolean;productRecommendations:boolean;marketingEmails:boolean};
const defaults:Pref={market:'US',language:'en-US',orderUpdates:true,productRecommendations:true,marketingEmails:false};

export function PreferencesForm(){
 const [p,setP]=useState<Pref>(()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(preferenceKey)||'{}')}}catch{return defaults}});
 const [message,setMessage]=useState('');
 function save(){localStorage.setItem(preferenceKey,JSON.stringify(p));localStorage.setItem('diginanba-market',p.market);localStorage.setItem('diginanba-language',p.language);setMessage('Preferences saved on this device.');}
 return <div className="account-form"><label>Country / market<select value={p.market} onChange={e=>{const market=e.target.value as Pref['market'];setP({...p,market,language:market==='US'?'en-US':'en-GB'})}}><option value="US">🇺🇸 United States · USD</option><option value="UK">🇬🇧 United Kingdom · GBP</option></select></label><label>Language<select value={p.language} onChange={e=>setP({...p,language:e.target.value as Pref['language']})}><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label><label className="account-check"><input type="checkbox" checked={p.orderUpdates} onChange={e=>setP({...p,orderUpdates:e.target.checked})}/> Order and download updates</label><label className="account-check"><input type="checkbox" checked={p.productRecommendations} onChange={e=>setP({...p,productRecommendations:e.target.checked})}/> Product recommendations</label><label className="account-check"><input type="checkbox" checked={p.marketingEmails} onChange={e=>setP({...p,marketingEmails:e.target.checked})}/> Marketing emails</label><button type="button" className="account-primary" onClick={save}>Save preferences</button>{message&&<p className="account-form-message">{message}</p>}</div>;
}
