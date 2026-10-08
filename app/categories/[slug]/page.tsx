import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/catalog';

const categoryMap: Record<string, { name: string; description: string; query: string }> = {
  'ebooks-guides': { name: 'Ebooks & Guides', description: 'Practical ebooks, playbooks and step-by-step digital guides.', query: 'Ebooks & Guides' },
  'excel-google-sheets': { name: 'Excel & Google Sheets', description: 'Spreadsheets, calculators, trackers and data tools for everyday work.', query: 'Excel & Sheets' },
  'templates-documents': { name: 'Templates & Documents', description: 'Ready-to-use professional templates and document systems.', query: 'Templates & Documents' },
  'design-assets': { name: 'Design Assets', description: 'Useful digital assets for design, presentations and creative work.', query: 'Design Assets' },
  'marketing-sales': { name: 'Marketing & Sales', description: 'Marketing systems, content planning and sales resources.', query: 'Marketing & Sales' },
  'ai-automation': { name: 'AI & Automation', description: 'Reusable AI workflows, prompts and automation resources.', query: 'AI & Automation' },
  'business-entrepreneurship': { name: 'Business & Entrepreneurship', description: 'Practical resources for building and running a business.', query: 'Business & Entrepreneurship' },
  'education-learning': { name: 'Education & Learning', description: 'Study resources, learning systems and educational digital products.', query: 'Education & Learning' },
  'software-code': { name: 'Software & Code', description: 'Code resources, software utilities and developer-focused digital products.', query: 'Software / Code' },
  'cad-engineering': { name: 'CAD & Engineering', description: 'Engineering tools, CAD resources and technical digital products.', query: 'CAD / Engineering' },
  'finance-accounting': { name: 'Finance & Accounting', description: 'Budgeting, cash-flow, accounting and financial planning resources.', query: 'Finance & Accounting' },
  'career-professional': { name: 'Career & Professional', description: 'Career, freelance and professional productivity resources.', query: 'Career & Professional' },
  'video-audio': { name: 'Video & Audio', description: 'Digital resources for video, audio and content production.', query: 'Video / Audio' },
  'photography': { name: 'Photography', description: 'Photography resources, workflows and creative digital tools.', query: 'Photography' },
  'printables': { name: 'Printables', description: 'Practical printable planners, worksheets and organizers.', query: 'Printables' },
  'personal-lifestyle': { name: 'Personal & Lifestyle', description: 'Digital resources for planning, organization and everyday life.', query: 'Personal / Lifestyle' },
};

export function generateStaticParams() {
  return Object.keys(categoryMap).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = categoryMap[slug];
  if (!category) return {};
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/categories/${slug}` },
    openGraph: { title: `${category.name} | DigiNanba`, description: category.description },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = categoryMap[slug];
  if (!category) notFound();

  const products = await getProducts('US', category.query);

  const itemList = products.map((p, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `https://diginanba.com/products/${p.slug}`,
    name: p.title,
  }));

  return (
    <main className="wrap catalog-page">
      <div className="sectionhead">
        <div>
          <div className="eyebrow">DigiNanba category</div>
          <h1>{category.name}</h1>
          <p className="muted">{category.description}</p>
        </div>
        <Link className="btn" href="/explore">Explore all</Link>
      </div>
      <div className="catalog-grid">
        {products.map((p) => (
          <Link href={`/products/${p.slug}`} className="product-card" key={p.id}>
            <span className="category">{p.category}</span>
            <h2>{p.title}</h2>
            <p className="muted">{p.description}</p>
            <div className="product-foot"><b>{p.price}</b><span>View product →</span></div>
          </Link>
        ))}
      </div>
      {!products.length && <div className="panel"><h2>Products are being added</h2><p className="muted">DigiNanba is expanding this category with practical digital products.</p></div>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: category.name,
        itemListElement: itemList,
      }) }} />
    </main>
  );
}
