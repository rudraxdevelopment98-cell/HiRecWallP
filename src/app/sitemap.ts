import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/service';
import { wallpaperPath } from '@/lib/wallpaper-url';
import { guideChapters } from '@/lib/guide';
import { DEVICES } from '@/lib/fit';
import { previewUrlFor } from '@/lib/catalogue';

const STATIC_PATHS = [
  '',
  '/explore',
  '/free',
  '/pricing',
  '/licence',
  '/terms',
  '/privacy',
  '/refunds',
  '/contact-takedown',
  '/faq',
  '/guide',
  '/collections',
  '/wallpapers-for',
  ...DEVICES.map((d) => `/wallpapers-for/${d.id}`),
  ...guideChapters(['customer', 'creator']).map((c) => `/guide/${c.slug}`),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
  }));

  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return entries;

  try {
    const supabase = createServiceClient();
    const [{ data }, { data: cats }] = await Promise.all([
      supabase
        .from('wallpapers')
        .select('slug, code, created_at, wallpaper_assets(variant, storage_key)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase.from('categories').select('slug'),
    ]);
    for (const c of cats ?? []) entries.push({ url: `${base}/collections/${c.slug as string}`, lastModified: now });
    for (const w of data ?? []) {
      // Image sitemap: the public (watermarked) preview, so Google Images can index it. Never the original.
      const preview = previewUrlFor((w.wallpaper_assets as { variant: string; storage_key: string }[] | null)?.find((a) => a.variant === 'preview')?.storage_key);
      entries.push({
        url: `${base}${wallpaperPath(w)}`,
        lastModified: w.created_at ? new Date(w.created_at) : now,
        ...(preview ? { images: [preview] } : {}),
      });
    }
  } catch {
    // Fall back to static entries only.
  }

  return entries;
}
