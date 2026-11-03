import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { listWallpapersByIds } from '@/lib/catalogue';
import { getSettings } from '@/lib/settings';
import type { RegionCode } from '@/lib/geo';
import type { WallpaperCard } from '@/types/catalogue';

/** Today's date in India (picks change at midnight IST). */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * Today's free wallpaper (chosen on first request of the day if the nightly
 * job hasn't run yet — pick_daily() is idempotent). Null when the feature is
 * off or there is nothing to pick.
 */
export async function getTodayPick(region: RegionCode): Promise<WallpaperCard | null> {
  try {
    if (!(await getSettings()).growth.daily_enabled) return null;
    const { data: id } = await createServiceClient().rpc('pick_daily', { p_day: istToday() });
    if (!id) return null;
    const [card] = await listWallpapersByIds([id as string], region);
    return card ?? null;
  } catch {
    return null;
  }
}
