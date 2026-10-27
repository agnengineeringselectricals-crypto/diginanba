import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getProducts } from '@/lib/catalog';
import type { Market } from '@/lib/market';
import AddToCartButton from './AddToCartButton';
import ProductEngagement from './ProductEngagement';
import ImprovementSuggestionForm from './ImprovementSuggestionForm';
import CustomizationRequestForm from '@/components/CustomizationRequestForm';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ market?: string }>;
};

export async function generateStaticParams() {
  return (await getProducts('US')).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = await searchParams;
  const market = (search.market === 'UK' || search.market === 'IN' ? search.market : 'US') as Market;
  const product = await getProduct(slug, market);
  if (!product) return {};

  return {
    title: product.title,
    description: product.description,
    alternates: { canonical: '/products/' + product.slug },
    openGraph: {
      type: 'website',
      title: product.title + ' | DigiNanba',
      description: product.description,
      url: 'https://diginanba.com/products/' + product.slug,
    },
  };
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = await searchParams;
  const market = (search.market === 'UK' || search.market === 'IN' ? search.market : 'US') as Market;
  const product = await getProduct(slug, market);
  if (!product) notFound();

  const related = (await getProducts(market, product.category))
    .filter((item) => item.slug !== product.slug)
    .slice(0, 3);

  const productUrl = 'https://diginanba.com/products/' + product.slug;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    category: product.category,
    brand: { '@type': 'Brand', name: 'DigiNanba' },
    url: productUrl,
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: product.currency,
      price: (product.amountMinor / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'DigiNanba', item: 'https://diginanba.com/' },
      { '@type': 'ListItem', position: 2, name: 'Explore', item: 'https://diginanba.com/explore' },
      { '@type': 'ListItem', position: 3, name: product.title, item: productUrl },
    ],
  };

  return (
    <main className="wrap product-page">
      <nav aria-label="Breadcrumb" className="product-breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">›</span>
        <Link href={'/explore?market=' + market}>Explore products</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{product.title}</span>
      </nav>

      <div className="product-hero">
        <div className="product-main-copy">
          <span className="category">{product.category}</span>
          <h1>{product.title}</h1>
          <p className="lead">{product.description}</p>
          <div className="buybox">
            <div>
              <span className="muted">{market === 'US' ? 'United States · USD' : market === 'UK' ? 'United Kingdom · GBP' : 'India · INR'}</span>
              <strong>{product.price}</strong>
            </div>
            <AddToCartButton product={{
              slug: product.slug,
              title: product.title,
              price: product.price,
              amountMinor: product.amountMinor,
              market,
            }} />
          </div>
          <p className="product-purchase-note">Review the file formats, compatibility and license details before purchase.</p>
        </div>

        <aside className="preview-card" aria-label="Product details">
          <div className="preview-icon" aria-hidden="true">✦</div>
          <h2>Product details</h2>
          <p><strong>Format</strong><br /><span className="muted">Check the listing description for included file types.</span></p>
          {product.creatorName && product.creatorName.trim().toLowerCase() !== 'diginanba' && <p><strong>Creator</strong><br /><span className="muted">{product.creatorName.trim().split(/\s+/).slice(0, 2).join(' ')}</span></p>}<p><strong>Category</strong><br /><span className="muted">{product.category}</span></p>
          <p><strong>Price</strong><br /><span className="muted">{product.price} for the selected market.</span></p>
          <p className="muted">Digital access is available only after a successful, confirmed checkout and when fulfillment is enabled for the item.</p>
        </aside>
      </div>

      <ProductEngagement product={{
        slug: product.slug,
        title: product.title,
        price: product.price,
        category: product.category,
      }} />

      <CustomizationRequestForm productId={product.id} productTitle={product.title} locale={market === 'IN' ? 'en-IN' : market === 'UK' ? 'en-GB' : 'en-US'} />

      <ImprovementSuggestionForm productId={product.id} locale={market === 'IN' ? 'en-IN' : market === 'UK' ? 'en-GB' : 'en-US'} />

      <section className="panel product-buying-guide" aria-labelledby="before-buy-heading">
        <h2 id="before-buy-heading">Before you buy</h2>
        <div className="product-detail-grid">
          <div>
            <h3>License and permitted use</h3>
            <p className="muted">Usage rights can vary by product. Review the specific license terms supplied with this item before using, modifying, sharing or reselling it. If terms are missing or unclear, contact the seller or DigiNanba support before purchase.</p>
          </div>
          <div>
            <h3>Files and compatibility</h3>
            <p className="muted">Check the listing for included file formats, required software, language and prerequisites. Updates, customer support and editable source files are included only when the product listing explicitly says so.</p>
          </div>
          <div>
            <h3>Payment and access</h3>
            <p className="muted">An item in your cart is not a completed purchase. Access should be provided only after payment is confirmed and the product's delivery flow is enabled.</p>
          </div>
          <div>
            <h3>Need another option?</h3>
            <p className="muted">Compare alternatives and review the product details before deciding.</p>
            <Link className="ref-view-product" href="/compare">Compare products →</Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="ref-section product-related" aria-labelledby="related-heading">
          <div className="ref-section-head">
            <div>
              <h2 id="related-heading">More products like this</h2>
              <p>Explore other resources that may fit your needs.</p>
            </div>
            <Link href={'/explore?q=' + encodeURIComponent(product.category) + '&market=' + market} className="ref-view-product">Browse category →</Link>
          </div>
          <div className="ref-products">
            {related.map((item) => (
              <article className="ref-product" key={item.slug}>
                <div className="ref-product-body">
                  <span className="ref-tag">{item.category}</span>
                  <h3><Link href={'/products/' + item.slug + '?market=' + market}>{item.title}</Link></h3>
                  <p>{item.description}</p>
                  <div className="ref-price-row">
                    <span className="ref-price">{item.price}</span>
                    <Link className="ref-view-product" href={'/products/' + item.slug + '?market=' + market}>View →</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </main>
  );
}
