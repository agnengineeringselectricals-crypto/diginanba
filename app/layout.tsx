import './globals.css';
import Providers from './providers';

export const metadata = {
  metadataBase: new URL('https://diginanba.com'),
  title: {
    default: 'DigiNanba — Digital Products for Work, Business & Life',
    template: '%s | DigiNanba',
  },
  description: 'Discover useful digital products, templates, spreadsheets, guides, AI workflows and practical tools for work, business, learning and everyday life.',
  applicationName: 'DigiNanba',
  keywords: ['digital products', 'digital downloads', 'templates', 'Excel templates', 'Google Sheets templates', 'ebooks', 'AI workflows', 'business tools'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'DigiNanba',
    title: 'DigiNanba — Digital Products for Work, Business & Life',
    description: 'Discover useful digital products, templates, spreadsheets, guides, AI workflows and practical tools.',
    url: 'https://diginanba.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DigiNanba — Digital Products for Work, Business & Life',
    description: 'Discover useful digital products, templates, spreadsheets, guides, AI workflows and practical tools.',
  },
  robots: { index: true, follow: true },
  category: 'Digital products marketplace',
  alternates: { canonical: '/' },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'DigiNanba',
  url: 'https://diginanba.com',
  description: 'Global digital-product marketplace for practical digital tools and resources.',
  sameAs: [],
};


const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'DigiNanba',
  url: 'https://diginanba.com',
  description: 'Discover practical digital products, templates, spreadsheets, guides and AI workflows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
