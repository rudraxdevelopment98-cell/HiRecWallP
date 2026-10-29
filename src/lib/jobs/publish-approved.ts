import 'server-only';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { serverEnv } from '@/lib/env';
import { generateVariants } from '@/lib/imaging';
import { getObject } from '@/lib/r2';
import { persistWallpaperAssets } from '@/lib/wallpaper-assets';
import { dHash } from '@/lib/phash';

interface Candidate {
  idx: number;
  phash: string;
  best?: boolean;
  originalKey?: string | null;
}

interface JobMeta {
  title?: string;
  slug?: string;
  description?: string;
  altText?: string;
  tags?: string[];
  suggestedFree?: boolean;
  category?: string;
}

function hashtagsFor(tags: string[]): string {
  return tags.map((t) => `#${t.replace(/[^a-z0-9]/gi, '')}`).join(' ');
}

/**
 * publish_approved: turn an approved generation job into a live wallpaper.
 * Fetches the chosen candidate's upscaled original, derives all variants +
 * watermarked previews, writes rows, seeds prices, and creates social drafts.
 */
export async function runPublishApproved(jobId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const brand = serverEnv().BRAND_NAME;

  const { data: job } = await supabase
    .from('generation_jobs')
    .select('id, candidates, metadata, status')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) throw new Error('generation job not found');

  const candidates = (job.candidates as Candidate[]) ?? [];
  const best = candidates.find((c) => c.best) ?? candidates[0];
  if (!best?.originalKey) throw new Error('no stored original for the chosen candidate');

  const meta = (job.metadata as JobMeta) ?? {};
  const title = meta.title ?? 'Untitled';
  const slug = meta.slug ?? `wallpaper-${jobId.slice(0, 8)}`;

  // Resolve category id from the niche slug, if it maps to a category.
  let categoryId: string | null = null;
  if (meta.category) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', meta.category)
      .maybeSingle();
    categoryId = cat?.id ?? null;
  }

  const original = await getObject('private', best.originalKey);
  const variants = await generateVariants(original, brand);

  const { data: wallpaper, error: wErr } = await supabase
    .from('wallpapers')
    .insert({
      slug,
      title,
      description: meta.description ?? null,
      alt_text: meta.altText ?? null,
      category_id: categoryId,
      tags: meta.tags ?? [],
      is_free: meta.suggestedFree ?? false,
      status: 'published',
      is_ai_generated: true,
      launch_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (wErr || !wallpaper) throw new Error('could not create wallpaper (slug taken?)');

  await persistWallpaperAssets(supabase, wallpaper.id, original, variants, async (v) =>
    v.variant === 'preview' ? dHash(v.buffer) : null,
  );
  const previewPublicUrl = process.env.R2_PUBLIC_BASE_URL
    ? `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/wallpapers/${wallpaper.id}/preview.jpg`
    : null;

  // Seed a price per region from the global rule (launch price).
  const { data: rules } = await supabase
    .from('price_rules')
    .select('region_code, base_price, launch_price')
    .eq('scope', 'global');
  for (const rule of rules ?? []) {
    await supabase.from('prices').upsert(
      {
        wallpaper_id: wallpaper.id,
        region_code: rule.region_code,
        current_price: rule.launch_price ?? rule.base_price,
      },
      { onConflict: 'wallpaper_id,region_code' },
    );
  }

  // Create social drafts (Instagram image + Pinterest pin) spread out.
  const tags = meta.tags ?? [];
  const caption = `${title} — ultra-HD AI wallpaper for your screen. ${hashtagsFor(tags)}`;
  const base = Date.now();
  await supabase.from('social_posts').insert([
    {
      wallpaper_id: wallpaper.id,
      platform: 'instagram',
      format: 'image',
      caption,
      hashtags: hashtagsFor(tags),
      media_url: previewPublicUrl,
      scheduled_for: new Date(base + 3 * 3600_000).toISOString(),
      status: 'scheduled',
    },
    {
      wallpaper_id: wallpaper.id,
      platform: 'pinterest',
      format: 'pin',
      caption,
      hashtags: hashtagsFor(tags),
      media_url: previewPublicUrl,
      scheduled_for: new Date(base + 4 * 3600_000).toISOString(),
      status: 'scheduled',
    },
  ]);

  await supabase
    .from('generation_jobs')
    .update({ status: 'approved', wallpaper_id: wallpaper.id })
    .eq('id', jobId);

  revalidatePath('/');
  revalidatePath('/explore');
  revalidatePath('/free');

  return { wallpaperId: wallpaper.id, slug, socialDrafts: 2 };
}
