import Link from 'next/link';

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  examples: string[];
  providerLabel: string;
  note: string;
};

export default function MarketplaceCategoryPage({ eyebrow, title, intro, examples, providerLabel, note }: Props) {
  return (
    <main style={{maxWidth:1120,margin:'0 auto',padding:'42px 22px 80px'}}>
      <Link href="/" style={{color:'#475467',textDecoration:'none'}}>← My DigiNanba</Link>
      <p style={{margin:'28px 0 8px',fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',fontSize:12,color:'#5264b5'}}>{eyebrow}</p>
      <h1 style={{fontSize:'clamp(32px,5vw,48px)',lineHeight:1.08,letterSpacing:'-.04em',margin:'0 0 14px',color:'#172033'}}>{title}</h1>
      <p style={{maxWidth:760,fontSize:18,lineHeight:1.65,color:'#475467'}}>{intro}</p>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,margin:'32px 0'}}>
        {examples.map((item)=><div key={item} style={{border:'1px solid #e4e7ec',borderRadius:16,padding:20,background:'#fff',fontWeight:700,color:'#243047'}}>{item}</div>)}
      </section>
      <section style={{borderRadius:18,padding:24,background:'#f3f6ff',border:'1px solid #dce5ff'}}>
        <h2 style={{margin:'0 0 8px',fontSize:22,color:'#172033'}}>{providerLabel}</h2>
        <p style={{margin:'0 0 16px',color:'#475467',lineHeight:1.6}}>{note}</p>
        <Link href="/signup" style={{display:'inline-flex',padding:'11px 17px',borderRadius:999,background:'#263c91',color:'#fff',fontWeight:700,textDecoration:'none'}}>Create a DigiNanba account</Link>
      </section>
      <p style={{marginTop:24,fontSize:13,color:'#667085'}}>Marketplace onboarding and listings are being introduced in stages. No provider, product, medical credential or candidate profile is represented as verified until the relevant review is completed.</p>
    </main>
  );
}
