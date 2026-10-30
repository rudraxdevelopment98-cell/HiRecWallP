import type { RegionCode } from '@/lib/geo';

export type WallpaperStatus = 'draft' | 'pending_review' | 'published' | 'archived';

export interface Category {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  /** Optional count for display in the category row. */
  count?: number;
  /** Optional thumbnail (demo/display). */
  thumbUrl?: string;
}

export interface WallpaperSet {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

export interface Wallpaper {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  alt_text: string | null;
  category_id: string | null;
  tags: string[];
  is_free: boolean;
  status: WallpaperStatus;
  is_ai_generated: boolean;
  human_edited: boolean;
  set_id: string | null;
  created_at: string;
  /** Public size metadata, filled at upload (migration 0009). */
  orientation?: 'portrait' | 'landscape' | 'square' | null;
  max_long_edge?: number | null;
  /** Paid device variants included, e.g. ['phone','tablet'] or ['desktop_4k','desktop_5k']. */
  devices?: string[];
}

/** A wallpaper plus its public preview URL and current price in a region. */
export interface WallpaperCard extends Wallpaper {
  previewUrl: string | null;
  price: number | null;
  region: RegionCode;
  /** Display metadata: resolution badge (largest paid size) and category label. */
  resolution?: '4K' | '5K';
  categoryName?: string;
}

export interface ExploreFilters {
  /** Mobile | Desktop | Tablet | Ultrawide (one or more). */
  devices?: string[];
  orientation?: 'portrait' | 'landscape';
  /** Minimum resolution: '4K' | '5K'. */
  resolution?: '4K' | '5K';
  category?: string;
  free?: boolean;
  sort?: 'newest' | 'oldest' | 'title';
  q?: string;
}
