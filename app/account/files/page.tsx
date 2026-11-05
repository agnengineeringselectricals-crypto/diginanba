import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function MyFilesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/account/files');

  return (
    <main style={{maxWidth:1040,margin:'0 auto',padding:'32px 20px 64px',color:'#172033'}}>
      <nav style={{fontSize:14,color:'#667085',marginBottom:20}}><Link href="/account" style={{color:'inherit'}}>My account</Link> <span aria-hidden="true">›</span> My Files</nav>
      <section style={{borderRadius:22,padding:'clamp(22px,4vw,38px)',background:'linear-gradient(120deg,#102a56,#225c83)',color:'#fff'}}>
        <div style={{fontSize:13,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',opacity:.8}}>DIGINANBA SECURE STORAGE</div>
        <h1 style={{fontSize:'clamp(30px,5vw,44px)',lineHeight:1.1,margin:'12px 0'}}>My Files</h1>
        <p style={{fontSize:16,lineHeight:1.65,maxWidth:650,margin:0,color:'#e4edf7'}}>Keep important personal and business documents in one private place, designed to remain available when you change devices.</p>
      </section>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,marginTop:22}}>
        {[
          ['Personal documents','Identity documents, certificates and records','▤'],
          ['Business files','Invoices, contracts and working documents','▣'],
          ['Photos & scans','Important images and scanned paperwork','▧'],
          ['My folders','Organise files in your own folder structure','▱'],
        ].map(([title,description,icon])=><article key={title} style={{border:'1px solid #e4e7ec',borderRadius:16,padding:18,background:'#fff'}}><div style={{fontSize:26,color:'#245b86'}}>{icon}</div><h2 style={{fontSize:17,margin:'10px 0 5px'}}>{title}</h2><p style={{fontSize:13,lineHeight:1.5,color:'#667085',margin:0}}>{description}</p></article>)}
      </section>

      <section style={{marginTop:22,border:'1px solid #d0d5dd',borderRadius:16,padding:20,background:'#f9fafb'}}>
        <h2 style={{fontSize:20,margin:'0 0 8px'}}>Secure storage is being prepared</h2>
        <p style={{fontSize:14,lineHeight:1.65,color:'#475467',margin:'0 0 14px'}}>We are completing private file storage, subscription billing, phone verification and trusted-device approval before accepting personal documents. Your files will not be exposed on a new or unrecognised device just because someone knows your password.</p>
        <div style={{display:'grid',gap:10}}>
          <div><strong>Already trusted device:</strong> access after normal sign-in and device verification.</div>
          <div><strong>New device, old device available:</strong> approve the new device from your existing trusted device. No recovery fee.</div>
          <div><strong>Old device lost:</strong> identity and phone verification, lost-device evidence review, and a separately disclosed recovery fee before approval.</div>
        </div>
      </section>

      <section style={{marginTop:18,border:'1px solid #e4e7ec',borderRadius:16,padding:20}}>
        <h2 style={{fontSize:18,margin:'0 0 8px'}}>Storage plans</h2>
        <p style={{fontSize:14,lineHeight:1.6,color:'#667085',margin:0}}>A paid storage subscription will determine your available storage capacity. Device recovery is a separate process; adding a device with approval from your existing trusted device will not incur a recovery fee. Plan prices and limits will be shown before subscription.</p>
      </section>
      <p style={{fontSize:12,lineHeight:1.6,color:'#98a2b3',marginTop:20}}>Do not upload sensitive documents to this section until the secure storage service is activated. This page is an early account preview, not an active file vault.</p>
    </main>
  );
}
