import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/service';

const STATIC_PATHS = [
  '',
  '/explore',
  '/free',
  '/pricing',
  '/search',
  '/licence',
  '/terms',
  '/privacy',
  '/refunds',
  '/contact-takedown',
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
    const { data } = await supabase
      .from('wallpapers')
      .select('slug, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(5000);
    for (const w of data ?? []) {
      entries.push({
        url: `${base}/w/${w.slug}`,
        lastModified: w.created_at ? new Date(w.created_at) : now,
      });
    }
  } catch {
    // Fall back to static entries only.
  }

  return entries;
}
