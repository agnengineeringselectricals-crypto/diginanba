import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/catalog';

const base = 'https://diginanba.com';

const categories = [
  'ebooks-guides','excel-google-sheets','templates-documents','design-assets',
  'marketing-sales','ai-automation','business-entrepreneurship','education-learning',
  'software-code','cad-engineering','finance-accounting','career-professional',
  'video-audio','photography','printables','personal-lifestyle'
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts('US');
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/explore`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...categories.map((slug) => ({
      url: `${base}/categories/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
