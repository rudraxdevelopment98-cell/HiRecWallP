import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { encodeMaster, type GeneratedVariant } from '@/lib/imaging';
import { putObject } from '@/lib/r2';

/**
 * Store a wallpaper's master + generated variants and record them in
 * wallpaper_assets. Master: wallpapers/<id>/master.jpg (private).
 */
export async function persistWallpaperAssets(
  supabase: SupabaseClient,
  wallpaperId: string,
  original: Buffer,
  variants: GeneratedVariant[],
  phashFor?: (v: GeneratedVariant) => Promise<string | null>,
): Promise<void> {
  const master = await encodeMaster(original);
  await putObject('private', `wallpapers/${wallpaperId}/master.${master.ext}`, master.buffer, master.contentType);

  for (const v of variants) {
    const key = `wallpapers/${wallpaperId}/${v.variant}.${v.ext}`;
    await putObject(v.bucket, key, v.buffer, v.contentType);
    await supabase.from('wallpaper_assets').insert({
      wallpaper_id: wallpaperId,
      variant: v.variant,
      width: v.width,
      height: v.height,
      bytes: v.buffer.byteLength,
      storage_bucket: v.bucket,
      storage_key: key,
      phash: phashFor ? await phashFor(v) : null,
    });
  }
}
