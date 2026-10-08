import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getProducts } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import AddToCartButton from './AddToCartButton';

export async function generateStaticParams() {
  const products = await getProducts('US');
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ market?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const market = (sp.market === 'UK' ? 'UK' : 'US') as Market;
  const p = await getProduct(slug, market);
  if (!p) return {};

  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: {
      type: 'website',
      title: `${p.title} | DigiNanba`,
      description: p.description,
      url: `https://diginanba.com/products/${p.slug}`,
    },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ market?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const market = (sp.market === 'UK' ? 'UK' : 'US') as Market;
  const p = await getProduct(slug, market);

  if (!p) notFound();

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.description,
    category: p.category,
    brand: { '@type': 'Brand', name: 'DigiNanba' },
    url: `https://diginanba.com/products/${p.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://diginanba.com/products/${p.slug}` },
    offers: {
      '@type': 'Offer',
      url: `https://diginanba.com/products/${p.slug}`,
      priceCurrency: p.currency,
      price: (p.amountMinor / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <main className="wrap product-page">
      <Link href={`/explore?market=${market}`} className="muted">← Back to marketplace</Link>

      <div className="product-hero">
        <div>
          <span className="category">{p.category}</span>
          <h1>{p.title}</h1>
          <p className="lead">{p.description}</p>

          <div className="buybox">
            <div>
              <span className="muted">
                {market === 'US' ? 'United States · USD' : 'United Kingdom · GBP'}
              </span>
              <strong>{p.price}</strong>
            </div>
            <AddToCartButton
              product={{
                slug: p.slug,
                title: p.title,
                price: p.price,
                amountMinor: p.amountMinor,
                market,
              }}
            />
          </div>
        </div>

        <div className="preview-card">
          <div className="preview-icon">✦</div>
          <h3>Digital download</h3>
          <p className="muted">Instant access after successful checkout.</p>
          <hr />
          <p>✓ Practical, ready-to-use resource</p>
          <p>✓ Market-localized edition</p>
          <p>✓ Secure digital delivery</p>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Why this digital product?</h2>
        <p className="muted">Built to help you solve a practical problem quickly. Product details, format, licensing and future version information will expand as DigiNanba's marketplace grows.</p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </main>
  );
}
