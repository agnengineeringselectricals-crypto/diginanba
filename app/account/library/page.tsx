import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type LibraryItem = { order_item_id: string; order_id: string; product_title: string; purchased_at: string | Date; has_download: boolean };

export default async function Library() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Faccount%2Flibrary');

  const result = await db.query(
    `SELECT oi.id AS order_item_id, o.id AS order_id,
            COALESCE(pe.title, p.title, 'Digital product') AS product_title,
            o.created_at AS purchased_at,
            EXISTS (SELECT 1 FROM product_assets pa WHERE pa.product_id = oi.product_id
              AND (pa.product_edition_id IS NULL OR pa.product_edition_id = oi.product_edition_id)
              AND pa.asset_kind = 'download' AND pa.scan_status = 'clean') AS has_download
     FROM entitlements e JOIN order_items oi ON oi.id = e.order_item_id
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN product_editions pe ON pe.id = oi.product_edition_id
     LEFT JOIN products p ON p.id = COALESCE(oi.product_id, pe.product_id)
     WHERE e.user_id = $1 AND e.status = 'active' AND o.status = 'paid'
     ORDER BY o.created_at DESC, oi.id`,
    [session.user.id],
  );
  const items = result.rows as LibraryItem[];

  return <main className="wrap dn-library-page">
    <Link href="/account" className="muted">← Account</Link>
    <div className="page-head"><div><div className="eyebrow">MY DIGITAL LIBRARY</div><h1>My DigiNanba Library</h1><p className="muted">Your verified purchases and secure downloads.</p></div></div>
    {items.length === 0 ? <section className="panel dn-library-empty"><div className="dn-library-icon" aria-hidden="true">📚</div><h2>Your library is waiting for your first verified purchase</h2><p className="muted">Only orders confirmed as paid by DigiNanba appear here. Download buttons are shown only for approved product files.</p><div className="dn-library-actions"><Link href="/account/orders" className="btn">View orders</Link><Link href="/explore" className="btn primary">Explore products</Link></div></section> :
      <section className="dn-library-list">{items.map((item) => <article className="panel dn-library-item" key={item.order_item_id}><div className="dn-library-icon" aria-hidden="true">📄</div><div className="dn-library-info"><h2>{item.product_title}</h2><p className="muted">Order {item.order_id} · Purchased {new Date(item.purchased_at).toLocaleDateString('en-IN')}</p>{item.has_download ? <p className="muted dn-library-note">File access is checked against your account and paid order.</p> : <p className="muted dn-library-note">The secure product file is not available yet. Please contact DigiNanba support if you need help.</p>}</div>{item.has_download ? <a className="btn primary" href={'/api/downloads/' + item.order_item_id}>Download securely</a> : <Link className="btn" href="/support">Contact support</Link>}</article>)}</section>}
    <style>{`.dn-library-page{padding-bottom:48px}.dn-library-page .page-head{margin-top:18px}.dn-library-empty{padding:34px 24px}.dn-library-icon{font-size:30px}.dn-library-empty h2{margin:12px 0 8px}.dn-library-empty p{max-width:650px;line-height:1.7;font-size:13px}.dn-library-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.dn-library-list{display:grid;gap:12px;margin-top:20px}.dn-library-item{display:flex;align-items:center;gap:16px;padding:20px}.dn-library-info{flex:1;min-width:0}.dn-library-info h2{font-size:16px;margin:0 0 6px}.dn-library-info p{font-size:12px;margin:0 0 4px;overflow-wrap:anywhere}.dn-library-item .btn{flex-shrink:0}@media(max-width:640px){.dn-library-item{align-items:flex-start;flex-wrap:wrap}.dn-library-info{flex-basis:calc(100% - 54px)}.dn-library-item .btn{width:100%;text-align:center}.dn-library-empty{padding:24px 18px}.dn-library-actions{display:grid}.dn-library-actions .btn{text-align:center}}`}</style>
  </main>;
}
