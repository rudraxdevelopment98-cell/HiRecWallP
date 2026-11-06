import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteObject, getObject, objectExists, putObject } from '@/lib/storage';
import { openImage } from '@/lib/image-safety';
import { fitKey } from '@/lib/fit';

const PAID = ['phone', 'tablet', 'desktop_4k', 'desktop_5k', 'ultrawide'];

/**
 * Pixel size of the artwork we crop from: the uploaded original when known
 * (source_width/height), else the largest generated size.
 */
export async function sourceSize(
  supabase: SupabaseClient,
  wallpaper: { id: string; source_width?: number | null; source_height?: number | null },
): Promise<{ w: number; h: number; masterKey: string | null; fallbackKey: string | null }> {
  const { data: assets } = await supabase
    .from('wallpaper_assets')
    .select('variant, width, height, storage_key')
    .eq('wallpaper_id', wallpaper.id)
    .in('variant', PAID);
  const largest = [...(assets ?? [])].sort((a, b) => Number(b.width) * Number(b.height) - Number(a.width) * Number(a.height))[0];
  const masterKey = `wallpapers/${wallpaper.id}/master.jpg`;
  const hasMaster = await objectExists('private', masterKey).catch(() => false);
  if (hasMaster && wallpaper.source_width && wallpaper.source_height) {
    return { w: wallpaper.source_width, h: wallpaper.source_height, masterKey, fallbackKey: largest?.storage_key ?? null };
  }
  return {
    w: Number(largest?.width ?? 0),
    h: Number(largest?.height ?? 0),
    masterKey: null,
    fallbackKey: (largest?.storage_key as string | undefined) ?? null,
  };
}

/** The exact-fit crop (cached in the private bucket under fit/, cleaned after 30 days). */
export async function ensureFitCrop(wallpaperId: string, w: number, h: number, sourceKey: string): Promise<string> {
  const key = fitKey(wallpaperId, w, h);
  if (await objectExists('private', key)) return key;
  const source = await getObject('private', sourceKey);
  const out = await openImage(source)
    .rotate()
    .resize(w, h, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  await putObject('private', key, out, 'image/jpeg');
  return key;
}

/**
 * Remove cached exact-fit crops of a wallpaper (and buyers' watermarked copies)
 * after its image changes. Sizes come from the download log (fit_size).
 */
export async function deleteFitCache(supabase: SupabaseClient, wallpaperId: string, entitlementIds: string[]): Promise<void> {
  const { data } = await supabase.from('downloads').select('fit_size').eq('wallpaper_id', wallpaperId).not('fit_size', 'is', null);
  const sizes = [...new Set((data ?? []).map((r) => r.fit_size as string))];
  for (const size of sizes) {
    const [w, h] = size.split('x').map(Number);
    await deleteObject('private', fitKey(wallpaperId, w!, h!)).catch(() => undefined);
    for (const e of entitlementIds) await deleteObject('private', `wm/${e}/fit-${size}.jpg`).catch(() => undefined);
  }
}
