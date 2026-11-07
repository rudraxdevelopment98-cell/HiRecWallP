import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AnnouncementBar } from '@/components/announcement-bar';
import { NavigationProgress } from '@/components/navigation-progress';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const brand = process.env.BRAND_NAME ?? 'HirecWallp';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brand} — 4K & 5K Wallpapers for Phone, Tablet & Desktop`,
    template: `%s · ${brand}`,
  },
  description:
    'Ultra-HD 4K and 5K wallpapers for phone, tablet and desktop — AI-crafted art, every size included, an exact fit for your screen and a free wallpaper every day.',
  applicationName: brand,
  openGraph: {
    type: 'website',
    siteName: brand,
    url: siteUrl,
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* Mark JS active before paint so scroll-reveals hide without a flash
            and content stays visible when JS is unavailable. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js');try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z&&document.cookie.indexOf('tz='+encodeURIComponent(z))<0)document.cookie='tz='+encodeURIComponent(z)+';path=/;max-age=31536000;samesite=lax'}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <NavigationProgress />
        <AnnouncementBar />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
