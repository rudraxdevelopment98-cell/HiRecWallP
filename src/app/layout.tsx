import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const brand = process.env.BRAND_NAME ?? 'HirecWallp';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brand} — Ultra-HD AI wallpapers`,
    template: `%s · ${brand}`,
  },
  description:
    'Ultra-high-resolution AI-generated wallpapers for phone, desktop and tablet. Free picks and cheap premium downloads.',
  openGraph: {
    type: 'website',
    siteName: brand,
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
