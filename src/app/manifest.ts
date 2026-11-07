import type { MetadataRoute } from 'next';

/** Web app manifest: lets people install the site like an app (Android/desktop "Install", iOS "Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'HirecWallp';
  return {
    name: `${brand} — 4K & 5K Wallpapers`,
    short_name: brand,
    description: 'Ultra-HD wallpapers for phone, tablet and desktop — every size included, exact fit for your screen.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f9fa',
    theme_color: '#171c26',
    categories: ['personalization', 'lifestyle', 'photo'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Explore', url: '/explore' },
      { name: 'Free wallpapers', url: '/free' },
      { name: 'My Library', url: '/library' },
    ],
  };
}
