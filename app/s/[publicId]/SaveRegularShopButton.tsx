'use client';

import { useState } from 'react';

export default function SaveRegularShopButton({ publicId }: { publicId:string }) {
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function save(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/marketplace/shops/regular',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({publicId})});
      const data=await response.json();
      setMessage(response.ok?(data.message||'Saved to My Regular Shops.'):data.error||'Please sign in to save this shop.');
    }catch{setMessage('Could not save this shop. Please try again.');}
    finally{setBusy(false);}
  }
  return <div><button type="button" disabled={busy} onClick={save} style={{border:0,borderRadius:999,padding:'12px 18px',background:'#176b4d',color:'#fff',fontWeight:750,cursor:'pointer'}}>{busy?'Saving…':'♡ Add to My Regular Shops'}</button>{message?<p role="status" style={{fontSize:13,color:'#475467'}}>{message}</p>:null}</div>;
}
