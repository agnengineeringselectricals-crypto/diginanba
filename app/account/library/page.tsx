import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Library() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccount%2Flibrary');

  return (
    <main className="wrap dn-library-page">
      <Link href="/account" className="muted">← Account</Link>
      <div className="page-head"><div><div className="eyebrow">MY DIGITAL LIBRARY</div><h1>My DigiNanba Library</h1><p className="muted">Your digital downloads and purchase access.</p></div></div>
      <section className="panel dn-library-empty">
        <div className="dn-library-icon" aria-hidden="true">📚</div>
        <h2>Your library is ready for eligible downloads</h2>
        <p className="muted">Digital downloads will appear here when purchasing is available and your payment and access have been confirmed. No downloads are available in your library yet.</p>
        <div className="dn-library-actions"><Link href="/account/orders" className="btn">View orders</Link><Link href="/explore" className="btn primary">Explore products</Link></div>
      </section>
      <style>{`.dn-library-page{padding-bottom:48px}.dn-library-page .page-head{margin-top:18px}.dn-library-empty{padding:34px 24px}.dn-library-icon{font-size:34px}.dn-library-empty h2{margin:12px 0 8px}.dn-library-empty p{max-width:650px;line-height:1.7;font-size:13px}.dn-library-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}@media(max-width:480px){.dn-library-empty{padding:24px 18px}.dn-library-actions{display:grid}.dn-library-actions .btn{text-align:center}}`}</style>
    </main>
  );
}
