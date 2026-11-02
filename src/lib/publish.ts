import 'server-only';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Publish wallpapers: status=published and a starting price per region from
 * the global rule (launch price when set). Existing price rows are kept.
 */
export async function publishWallpapers(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createServiceClient();
  const { data: updated, error } = await supabase
    .from('wallpapers')
    .update({ status: 'published', launch_at: new Date().toISOString() })
    .in('id', ids)
    .neq('status', 'published')
    .select('id');
  if (error) throw error;

  const { data: rules } = await supabase.from('price_rules').select('region_code, base_price, launch_price').eq('scope', 'global');
  const rows = ids.flatMap((id) =>
    (rules ?? []).map((r) => ({ wallpaper_id: id, region_code: r.region_code, current_price: r.launch_price ?? r.base_price })),
  );
  if (rows.length) {
    await supabase.from('prices').upsert(rows, { onConflict: 'wallpaper_id,region_code', ignoreDuplicates: true });
  }
  for (const p of ['/', '/explore', '/free']) revalidatePath(p);
  return updated?.length ?? 0;
}
