import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="panel">
        <div className="eyebrow">404</div>
        <h1>We could not find that page.</h1>
        <p className="muted">The product or page may have moved, or the address may be incorrect.</p>
        <div style={{ marginTop: 20 }}>
          <Link className="btn primary" href="/explore">Explore digital products</Link>
        </div>
      </div>
    </main>
  );
}
