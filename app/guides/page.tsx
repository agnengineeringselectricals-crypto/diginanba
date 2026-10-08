import Link from 'next/link';

const guides = [{
  slug: 'small-business-cash-flow',
  title: 'Small Business Cash Flow: A Practical Digital Toolkit',
  description: 'Learn what to track each month and which digital templates can make cash-flow planning easier.',
}];

export const metadata = {
  title: 'Digital Product Guides',
  description: 'Practical guides that help you choose and use digital products for work, business and everyday problems.',
  alternates: { canonical: '/guides' },
};

export default function GuidesPage() {
  return (
    <main className="wrap catalog-page">
      <div className="sectionhead">
        <div><div className="eyebrow">DigiNanba Guides</div><h1>Practical guides for real digital-product problems</h1><p className="muted">Useful information first. Products are recommended only when they genuinely help solve the problem.</p></div>
        <Link className="btn" href="/explore">Explore products</Link>
      </div>
      <div className="catalog-grid">
        {guides.map((guide) => <Link key={guide.slug} href={'/guides/' + guide.slug} className="product-card"><span className="category">Guide</span><h2>{guide.title}</h2><p className="muted">{guide.description}</p><div className="product-foot"><span>Read guide →</span></div></Link>)}
      </div>
    </main>
  );
}