import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { hammingDistance, NEAR_DUPLICATE_THRESHOLD } from '@/lib/phash';

export interface DuplicateMatch {
  id: string;
  title: string;
  slug: string;
  code: string | null;
  status: string;
  distance: number;
}

/**
 * Closest existing wallpaper whose original looks the same (dHash Hamming
 * distance ≤ threshold), ignoring archived ones and `excludeId`. Scans in pages;
 * fine for tens of thousands of wallpapers (16-byte hashes).
 */
export async function findDuplicate(phash: string, excludeId?: string | null, threshold = NEAR_DUPLICATE_THRESHOLD): Promise<DuplicateMatch | null> {
  const s = createServiceClient();
  let best: DuplicateMatch | null = null;
  for (let from = 0; from < 100_000; from += 1000) {
    const { data } = await s
      .from('wallpapers')
      .select('id, title, slug, code, status, phash')
      .not('phash', 'is', null)
      .neq('status', 'archived')
      .order('created_at')
      .range(from, from + 999);
    const rows = (data ?? []) as (Omit<DuplicateMatch, 'distance'> & { phash: string })[];
    for (const r of rows) {
      if (r.id === excludeId) continue;
      const d = hammingDistance(r.phash, phash);
      if (d <= threshold && (!best || d < best.distance)) best = { id: r.id, title: r.title, slug: r.slug, code: r.code, status: r.status, distance: d };
    }
    if (rows.length < 1000 || best?.distance === 0) break;
  }
  return best;
}

/** A slug not used by any wallpaper yet (adds -2, -3… when needed). */
export async function uniqueSlug(base: string, excludeId?: string | null): Promise<string> {
  const root = base.slice(0, 70).replace(/-+$/, '') || 'wallpaper';
  const { data } = await createServiceClient().from('wallpapers').select('id, slug').like('slug', `${root}%`);
  const taken = new Set((data ?? []).filter((r) => r.id !== excludeId).map((r) => r.slug as string));
  if (!taken.has(root)) return root;
  for (let i = 2; i < 1000; i += 1) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now().toString(36)}`;
}

/** "canyon_river-4K final.jpg" → "Canyon River" (fallback title without AI). */
export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\-.]+/g, ' ');
  const words = base
    .split(/\s+/)
    .filter((w) => w && !/^(\d+k|\d{3,5}x\d{3,5}|final|copy|v\d+|img|dsc|image|wallpaper|\d+)$/i.test(w))
    .slice(0, 6);
  const t = words.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
  return t || 'Untitled wallpaper';
}
