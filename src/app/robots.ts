import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private or per-person pages (referral redirects, gift codes, sign-in flows) stay out of search.
        disallow: ['/admin', '/api', '/account', '/library', '/checkout', '/cart', '/auth', '/login', '/r/', '/gift/', '/creator/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
