import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'DigiNanba — Global Digital Products',
  description: 'Discover, buy and download digital products.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
