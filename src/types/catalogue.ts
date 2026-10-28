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
}

/** A wallpaper plus its public preview URL and current price in a region. */
export interface WallpaperCard extends Wallpaper {
  previewUrl: string | null;
  price: number | null;
  region: RegionCode;
  /** Optional display metadata (ratings, resolution badge, category label). */
  rating?: number;
  reviews?: number;
  resolution?: '4K' | '5K' | '8K';
  categoryName?: string;
}

export interface ExploreFilters {
  device?: string;
  category?: string;
  free?: boolean;
  sort?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
  q?: string;
}
