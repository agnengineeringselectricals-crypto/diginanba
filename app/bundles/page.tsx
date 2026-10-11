import Link from 'next/link';
import { getProducts } from '@/lib/catalog';
import AddBundleButton from './AddBundleButton';

const bundleDefinitions = [
  {
    slug: 'small-business-starter',
    title: 'Small Business Starter Kit',
    description: 'Plan the business, organize daily operations and keep the numbers visible.',
    categories: ['Business & Entrepreneurship', 'Templates & Documents', 'Finance & Accounting'],
    keywords: ['business', 'startup', 'invoice', 'cashflow', 'client onboarding'],
  },
  {
    slug: 'creator-growth-toolkit',
    title: 'Creator Growth Toolkit',
    description: 'Build a repeatable content and marketing workflow with reusable AI support.',
    categories: ['Marketing & Sales', 'AI & Automation', 'Career & Professional'],
    keywords: ['creator', 'content', 'marketing', 'ai prompt', 'freelance'],
  },
  {
    slug: 'planning-and-productivity-pack',
    title: 'Planning & Productivity Pack',
    description: 'Bring project planning, cost estimation and repeatable processes together.',
    categories: ['Excel & Sheets', 'Templates & Documents', 'Business & Entrepreneurship'],
    keywords: ['project', 'planner', 'cost', 'operations', 'spreadsheet'],
  },
];

export default async function BundlesPage() {
  const products = await getProducts('US');
  const bundles = bundleDefinitions.map((definition) => {
    const selected = products.filter((product) => {
      const searchable = (product.title + ' ' + product.description + ' ' + product.category).toLowerCase();
      return definition.keywords.some((keyword) => searchable.includes(keyword));
    }).slice(0, 3);
    const items = selected.length >= 2
      ? selected
      : products.filter((product) =>
          definition.categories.some((category) => product.category.toLowerCase().includes(category.toLowerCase().split(' ')[0]))
        ).slice(0, 3);
    return { ...definition, items, totalMinor: items.reduce((sum, product) => sum + product.amountMinor, 0) };
  });

  return (
    <main className="wrap">
      <div className="page-head">
        <div>
          <div className="eyebrow">CURATED COLLECTIONS</div>
          <h1>Digital product bundles</h1>
          <p className="muted">Useful resources grouped around a goal. Add a collection to your cart and review the individual items before checkout.</p>
        </div>
        <Link className="btn" href="/explore">Explore all products</Link>
      </div>
      <div className="product-list-grid">
        {bundles.map((bundle) => (
          <article className="panel" key={bundle.slug}>
            <span className="category">CURATED BUNDLE</span>
            <h2>{bundle.title}</h2>
            <p className="muted">{bundle.description}</p>
            {bundle.items.length ? (
              <>
                <ul className="feature-list">
                  {bundle.items.map((product) => (
                    <li key={product.slug}><Link href={'/products/' + product.slug}>{product.title}</Link> — {product.price}</li>
                  ))}
                </ul>
                <div className="product-foot">
                  <strong>Combined price: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(bundle.totalMinor / 100)}</strong>
                </div>
                <p className="muted">Current individual prices added together; no bundle discount is applied.</p>
                <AddBundleButton products={bundle.items.map((product) => ({ slug: product.slug, title: product.title, price: product.price, amountMinor: product.amountMinor, market: 'US' as const }))} />
              </>
            ) : (
              <p className="muted">More products are being added to this collection.</p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
