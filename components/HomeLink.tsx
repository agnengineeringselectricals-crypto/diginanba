import Link from 'next/link';

export default function HomeLink() {
  return (
    <div style={{ marginBottom: 18 }}>
      <Link href="/" aria-label="Go to DigiNanba home page" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', border: '1px solid #d0d5dd', borderRadius: 999, background: '#fff', color: '#344054', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
        <span aria-hidden="true">←</span> Home
      </Link>
    </div>
  );
}
