import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

export const PAID_VARIANT_LABELS: Record<string, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  desktop_4k: 'Desktop 4K',
  desktop_5k: 'Desktop 5K',
  ultrawide: 'Ultrawide',
};
export const FREE_VARIANT_LABELS: Record<string, string> = {
  free_phone: 'Free · Phone',
  free_desktop: 'Free · Desktop',
};
const ORDER = [...Object.keys(PAID_VARIANT_LABELS), ...Object.keys(FREE_VARIANT_LABELS)];

/**
 * Downloadable variants that exist per wallpaper (names only, never keys).
 * Private asset rows are hidden from users by RLS, so this reads with the
 * service role. Sizes now depend on each artwork's orientation/resolution.
 */
export async function downloadableVariants(wallpaperIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (wallpaperIds.length === 0) return out;
  try {
    const { data } = await createServiceClient()
      .from('wallpaper_assets')
      .select('wallpaper_id, variant')
      .in('wallpaper_id', wallpaperIds)
      .in('variant', ORDER);
    for (const row of data ?? []) {
      const list = out.get(row.wallpaper_id as string) ?? [];
      list.push(row.variant as string);
      out.set(row.wallpaper_id as string, list);
    }
    for (const list of out.values()) list.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  } catch {
    // Not configured — callers fall back to defaults.
  }
  return out;
}
