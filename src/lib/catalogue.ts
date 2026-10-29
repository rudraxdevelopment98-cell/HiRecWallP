import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { DEFAULT_REGION, isRegionCode, type RegionCode } from '@/lib/geo';
import { DEMO_CATEGORIES, demoWallpaperBySlug, demoWallpapers } from '@/lib/demo';
import type {
  Category,
  ExploreFilters,
  Wallpaper,
  WallpaperCard,
  WallpaperSet,
} from '@/types/catalogue';

/** Apply explore filters to an in-memory list (demo-fallback path). */
function filterDemo(items: WallpaperCard[], filters: ExploreFilters, limit: number): WallpaperCard[] {
  let out = items;
  if (filters.free !== undefined) out = out.filter((w) => w.is_free === filters.free);
  if (filters.category) out = out.filter((w) => w.category_id === `cat-${filters.category}`);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    out = out.filter(
      (w) => w.title.toLowerCase().includes(q) || w.tags.some((t) => t.includes(q)),
    );
  }
  return out.slice(0, limit);
}

/** Whether Supabase is configured. When false, data helpers return empty sets. */
function dbConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

let liveCheck: { at: number; live: boolean } | null = null;

/**
 * True when the catalogue should come from the database: Supabase is
 * configured AND at least one wallpaper is published. Until the first real
 * upload, the demo catalogue keeps the storefront populated (demo items can't
 * be bought). Cached for a minute per server instance.
 */
async function catalogueLive(): Promise<boolean> {
  if (!dbConfigured()) return false;
  if (liveCheck && Date.now() - liveCheck.at < 60_000) return liveCheck.live;
  try {
    const { count } = await createClient()
      .from('wallpapers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published');
    liveCheck = { at: Date.now(), live: (count ?? 0) > 0 };
  } catch {
    liveCheck = { at: Date.now(), live: false };
  }
  return liveCheck.live;
}

/** The visitor's current display region (cookie, seeded by middleware). */
export function getDisplayRegion(): RegionCode {
  const value = cookies().get('region')?.value;
  return isRegionCode(value) ? value : DEFAULT_REGION;
}

function publicBaseUrl(): string {
  return process.env.R2_PUBLIC_BASE_URL ?? '';
}

function previewUrlFor(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const base = publicBaseUrl().replace(/\/$/, '');
  return base ? `${base}/${storageKey}` : null;
}

type AssetRow = { variant: string; storage_key: string };
type PriceRow = { region_code: string; current_price: number };
type WallpaperRow = Wallpaper & {
  wallpaper_assets?: AssetRow[] | null;
  prices?: PriceRow[] | null;
};

function toCard(row: WallpaperRow, region: RegionCode): WallpaperCard {
  const preview =
    row.wallpaper_assets?.find((a) => a.variant === 'preview') ??
    row.wallpaper_assets?.find((a) => a.variant === 'preview_crop') ??
    null;
  const price = row.prices?.find((p) => p.region_code === region)?.current_price ?? null;
  return {
    ...row,
    previewUrl: previewUrlFor(preview?.storage_key),
    price,
    region,
  };
}

const CARD_SELECT =
  '*, wallpaper_assets(variant, storage_key), prices(region_code, current_price)';

export async function listPublishedWallpapers(
  filters: ExploreFilters,
  region: RegionCode,
  limit = 48,
): Promise<WallpaperCard[]> {
  if (!(await catalogueLive())) return filterDemo(demoWallpapers(region), filters, limit);
  try {
    const supabase = createClient();
    let query = supabase
      .from('wallpapers')
      .select(CARD_SELECT)
      .eq('status', 'published')
      .limit(limit);

    if (filters.free !== undefined) query = query.eq('is_free', filters.free);
    if (filters.category) {
      const cat = await getCategoryBySlug(filters.category);
      if (cat) query = query.eq('category_id', cat.id);
    }
    if (filters.q) query = query.ilike('title', `%${filters.q}%`);

    switch (filters.sort) {
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as WallpaperRow[]).map((row) => toCard(row, region));
  } catch {
    return [];
  }
}

export async function getWallpaperBySlug(
  slug: string,
  region: RegionCode,
): Promise<WallpaperCard | null> {
  if (!(await catalogueLive())) return demoWallpaperBySlug(slug, region);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('wallpapers')
      .select(CARD_SELECT)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error || !data) return null;
    return toCard(data as WallpaperRow, region);
  } catch {
    return null;
  }
}

export async function listCategories(): Promise<Category[]> {
  if (!(await catalogueLive())) return DEMO_CATEGORIES;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return data as Category[];
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!(await catalogueLive())) return DEMO_CATEGORIES.find((c) => c.slug === slug) ?? null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as Category;
  } catch {
    return null;
  }
}

export interface CreditPack {
  id: string;
  region_code: string;
  currency: string;
  amount_minor: number;
  credits: number;
  active: boolean;
}

export async function listCreditPacks(region: RegionCode): Promise<CreditPack[]> {
  if (!dbConfigured()) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('region_code', region)
      .eq('active', true)
      .order('credits', { ascending: true });
    if (error || !data) return [];
    return data as CreditPack[];
  } catch {
    return [];
  }
}

export async function getSetBySlug(slug: string): Promise<WallpaperSet | null> {
  if (!dbConfigured()) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('wallpaper_sets')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as WallpaperSet;
  } catch {
    return null;
  }
}
