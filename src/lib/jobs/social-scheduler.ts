import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { getSocialProvider } from '@/lib/social';
import { publicEnv } from '@/lib/env';

// Soft daily caps (well under API limits). IG 2–3/day, Pinterest 5–10/day.
const DAILY_LIMIT: Record<string, number> = { instagram: 3, pinterest: 10, youtube_shorts: 2 };

interface DuePost {
  id: string;
  wallpaper_id: string | null;
  platform: 'instagram' | 'pinterest' | 'youtube_shorts';
  caption: string | null;
  media_url: string | null;
  wallpapers: { slug: string } | null;
}

/**
 * social_scheduler: publish due social_posts, respecting per-platform daily
 * caps, and record external_id / error. Idempotent per post (only 'scheduled'
 * rows are picked up).
 */
export async function runSocialScheduler(): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();

  // Count what each platform already posted in the last 24h.
  const { data: recent } = await supabase
    .from('social_posts')
    .select('platform')
    .eq('status', 'posted')
    .gte('created_at', dayAgo);
  const postedToday: Record<string, number> = {};
  for (const r of recent ?? []) postedToday[r.platform] = (postedToday[r.platform] ?? 0) + 1;

  const { data: due } = await supabase
    .from('social_posts')
    .select('id, wallpaper_id, platform, caption, media_url, wallpapers(slug)')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(25)
    .returns<DuePost[]>();

  let posted = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of due ?? []) {
    const cap = DAILY_LIMIT[post.platform] ?? 3;
    if ((postedToday[post.platform] ?? 0) >= cap) {
      skipped++;
      continue; // leave scheduled; next run retries
    }
    try {
      const link = post.wallpapers?.slug
        ? `${publicEnv.NEXT_PUBLIC_SITE_URL}/w/${post.wallpapers.slug}?utm_source=${post.platform}`
        : undefined;
      const result = await getSocialProvider(post.platform).publish({
        platform: post.platform,
        caption: post.caption ?? '',
        mediaUrl: post.media_url,
        linkUrl: link,
      });
      await supabase
        .from('social_posts')
        .update({ status: 'posted', external_id: result.externalId, error: null })
        .eq('id', post.id);
      postedToday[post.platform] = (postedToday[post.platform] ?? 0) + 1;
      posted++;
    } catch (err) {
      await supabase
        .from('social_posts')
        .update({ status: 'failed', error: err instanceof Error ? err.message : 'publish failed' })
        .eq('id', post.id);
      failed++;
    }
  }

  return { posted, skipped, failed };
}
