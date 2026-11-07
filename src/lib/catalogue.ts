import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { publicObjectUrl } from '@/lib/storage';
import { cache } from 'react';
import { DEFAULT_REGION, REGION_RANK, normaliseCountry, pickPricePoints, strictestContext, type PriceContext, type RegionCode } from '@/lib/geo';
import { countryForTimeZone } from '@/lib/timezones';
import { isOnSale } from '@/lib/sale-window';
import { getSettings } from '@/lib/settings';
import { DEMO_CATEGORIES, demoWallpaperBySlug, demoWallpapers } from '@/lib/demo';
import { parseWallpaperParam } from '@/lib/wallpaper-url';
import type {
  Category,
  ExploreFilters,
  Wallpaper,
  WallpaperCard,
  WallpaperSet,
} from '@/types/catalogue';

/** Explore "Device" filter → the paid variant that must exist. */
const DEVICE_VARIANT: Record<string, string> = {
  Mobile: 'phone',
  Tablet: 'tablet',
  Desktop: 'desktop_4k',
  Ultrawide: 'ultrawide',
};
const RESOLUTION_MIN_EDGE: Record<string, number> = { '4K': 3840, '5K': 5120 };

export interface PagedWallpapers {
  items: WallpaperCard[];
  total: number;
  page: number;
  totalPages: number;
}

function resolutionLabel(maxLongEdge: number | null | undefined): WallpaperCard['resolution'] {
  if (!maxLongEdge) return undefined;
  return maxLongEdge >= 5120 ? '5K' : '4K';
}

/** Apply explore filters to an in-memory list (demo-fallback path). */
function filterDemo(items: WallpaperCard[], filters: ExploreFilters): WallpaperCard[] {
  let out = items;
  if (filters.free !== undefined) out = out.filter((w) => w.is_free === filters.free);
  if (filters.category) out = out.filter((w) => w.category_id === `cat-${filters.category}`);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    out = out.filter((w) => w.title.toLowerCase().includes(q) || w.tags.some((t) => t.includes(q)));
  }
  if (filters.orientation) out = out.filter((w) => w.orientation === filters.orientation);
  if (filters.devices?.length) {
    const wanted = filters.devices.map((d) => DEVICE_VARIANT[d]).filter(Boolean) as string[];
    out = out.filter((w) => wanted.some((v) => w.devices?.includes(v)));
  }
  if (filters.resolution) {
    const min = RESOLUTION_MIN_EDGE[filters.resolution] ?? 0;
    out = out.filter((w) => (w.max_long_edge ?? 0) >= min);
  }
  if (filters.sort === 'oldest') out = [...out].reverse();
  if (filters.sort === 'title') out = [...out].sort((a, b) => a.title.localeCompare(b.title));
  return out;
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
    const { count } = await (await createClient())
      .from('wallpapers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published');
    liveCheck = { at: Date.now(), live: (count ?? 0) > 0 };
  } catch {
    liveCheck = { at: Date.now(), live: false };
  }
  return liveCheck.live;
}

/** Country of the visitor's IP (Vercel/Cloudflare edge header — not user-settable). */
async function ipCountry(): Promise<string | null> {
  const h = await headers();
  const fromHeader = normaliseCountry(h.get('x-vercel-ip-country') ?? h.get('cf-ipcountry'));
  if (fromHeader) return fromHeader;
  // Local dev / tests only (no edge header): the middleware-seeded cookie.
  return process.env.VERCEL ? null : normaliseCountry((await cookies()).get('country')?.value);
}

/** Country implied by the browser's time zone (cookie set by a tiny script in the root layout). */
async function timeZoneCountry(): Promise<string | null> {
  const tz = (await cookies()).get('tz')?.value;
  return tz ? countryForTimeZone(decodeURIComponent(tz)) : null;
}

/** The signed-in buyer's locked price country (set by their first paid order). */
export const getLockedPriceCountry = cache(async (): Promise<string | null> => {
  if (!dbConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data } = await supabase.from('profiles').select('price_country').eq('id', auth.user.id).maybeSingle();
    return normaliseCountry(data?.price_country as string | undefined);
  } catch {
    return null;
  }
});

/**
 * Where this visitor is priced: the most expensive tier among their locked
 * account country, IP country and time-zone country (admin tier overrides
 * applied). Visitors can't pick it — like Netflix, Spotify and Steam.
 */
export const getPriceContext = cache(async (): Promise<PriceContext> => {
  const [locked, ip, tz, settings] = await Promise.all([getLockedPriceCountry(), ipCountry(), timeZoneCountry(), getSettings()]);
  return strictestContext([locked, ip, tz], settings.country_tiers);
});

/** Pricing context for a checkout: as above, plus the declared billing country. */
export async function getChargeContext(billingCountry: string | null | undefined): Promise<PriceContext> {
  const [base, settings] = await Promise.all([getPriceContext(), getSettings()]);
  const ctx = strictestContext([base.country, billingCountry], settings.country_tiers, base.region);
  // Never drop below the base tier (e.g. when base came from the default).
  return REGION_RANK[ctx.region] >= REGION_RANK[base.region] ? ctx : base;
}

/** The visitor's pricing country (see getPriceContext). */
export async function getDisplayCountry(): Promise<string | null> {
  return (await getPriceContext()).country;
}

/** The visitor's pricing tier (see getPriceContext). */
export async function getDisplayRegion(): Promise<RegionCode> {
  return (await getPriceContext()).region;
}

/** Public (watermarked preview) URL for a storage key, via the active provider. */
export function previewUrlFor(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  try {
    return publicObjectUrl(storageKey);
  } catch {
    return null;
  }
}

type AssetRow = { variant: string; storage_key: string };
type PriceRow = { region_code: string; current_price: number };
type WallpaperRow = Wallpaper & {
  wallpaper_assets?: AssetRow[] | null;
  prices?: PriceRow[] | null;
  categories?: { name: string; slug?: string } | null;
};

/**
 * Default price per region from the global price rule. Wallpapers without
 * their own `prices` row (e.g. admin uploads before the pricing job runs)
 * show this, matching what checkout charges (getRegionPrice).
 */
async function globalBasePrice(region: RegionCode): Promise<number | null> {
  try {
    const { data } = await (await createClient())
      .from('price_rules')
      .select('base_price')
      .eq('region_code', region)
      .eq('scope', 'global')
      .maybeSingle();
    // price_rules are admin-read only under RLS; fall back to the seeded defaults.
    if (data?.base_price != null) return Number(data.base_price);
  } catch {
    /* ignore */
  }
  return ({ IN: 1, T1: 1, T2: 1, T3: 1, T4: 1 } as Record<RegionCode, number>)[region] ?? null;
}

function toCard(row: WallpaperRow, region: RegionCode, fallbackPrice: number | null): WallpaperCard {
  const preview =
    row.wallpaper_assets?.find((a) => a.variant === 'preview') ??
    row.wallpaper_assets?.find((a) => a.variant === 'preview_crop') ??
    null;
  const own = row.prices?.find((p) => p.region_code === region)?.current_price;
  const { wallpaper_assets: _a, prices: _p, categories, ...rest } = row;
  return {
    ...rest,
    previewUrl: previewUrlFor(preview?.storage_key),
    price: row.is_free ? null : own != null ? Number(own) : fallbackPrice,
    region,
    resolution: resolutionLabel(row.max_long_edge),
    categoryName: categories?.name,
    categorySlug: categories?.slug,
  };
}

const CARD_SELECT =
  '*, wallpaper_assets(variant, storage_key), prices(region_code, current_price), categories(name, slug)';

/**
 * One page of published wallpapers matching the explore filters, plus totals
 * for pagination.
 */
export async function searchWallpapers(
  filters: ExploreFilters,
  region: RegionCode,
  page = 1,
  perPage = 24,
): Promise<PagedWallpapers> {
  const safePage = Math.max(1, Math.floor(page));
  if (!(await catalogueLive())) {
    const all = filterDemo(demoWallpapers(region), filters);
    const totalPages = Math.max(1, Math.ceil(all.length / perPage));
    return {
      items: all.slice((safePage - 1) * perPage, safePage * perPage),
      total: all.length,
      page: safePage,
      totalPages,
    };
  }
  try {
    const supabase = (await createClient());
    let query = supabase
      .from('wallpapers')
      .select(CARD_SELECT, { count: 'exact' })
      .eq('status', 'published');

    if (filters.free !== undefined) query = query.eq('is_free', filters.free);
    if (filters.category) {
      const cat = await getCategoryBySlug(filters.category);
      if (!cat) return { items: [], total: 0, page: safePage, totalPages: 1 };
      query = query.eq('category_id', cat.id);
    }
    if (filters.q) {
      const q = filters.q.replace(/[%,(){}"\\]/g, ' ').trim();
      if (q) query = query.or(`title.ilike.%${q}%,tags.cs.{${q.toLowerCase()}}`);
    }
    if (filters.orientation) query = query.eq('orientation', filters.orientation);
    if (filters.devices?.length) {
      const wanted = filters.devices.map((d) => DEVICE_VARIANT[d]).filter(Boolean) as string[];
      if (wanted.length) query = query.overlaps('devices', wanted);
    }
    if (filters.resolution) {
      query = query.gte('max_long_edge', RESOLUTION_MIN_EDGE[filters.resolution] ?? 0);
    }

    if (filters.sort === 'oldest') query = query.order('created_at', { ascending: true });
    else if (filters.sort === 'title') query = query.order('title', { ascending: true });
    else query = query.order('created_at', { ascending: false });

    const from = (safePage - 1) * perPage;
    const [{ data, error, count }, fallback] = await Promise.all([
      query.range(from, from + perPage - 1),
      globalBasePrice(region),
    ]);
    if (error || !data) return { items: [], total: 0, page: safePage, totalPages: 1 };
    const total = count ?? data.length;
    return {
      items: (data as WallpaperRow[]).map((row) => toCard(row, region, fallback)),
      total,
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  } catch {
    return { items: [], total: 0, page: safePage, totalPages: 1 };
  }
}

/** First `limit` published wallpapers matching the filters (home, related…). */
export async function listPublishedWallpapers(
  filters: ExploreFilters,
  region: RegionCode,
  limit = 48,
): Promise<WallpaperCard[]> {
  return (await searchWallpapers(filters, region, 1, limit)).items;
}

/** Published wallpapers by id, in the given order (favourites, sets). */
export async function listWallpapersByIds(ids: string[], region: RegionCode): Promise<WallpaperCard[]> {
  if (ids.length === 0) return [];
  if (!(await catalogueLive())) {
    const demo = demoWallpapers(region);
    return ids.map((id) => demo.find((w) => w.id === id)).filter(Boolean) as WallpaperCard[];
  }
  try {
    const [{ data }, fallback] = await Promise.all([
      (await createClient()).from('wallpapers').select(CARD_SELECT).in('id', ids).eq('status', 'published'),
      globalBasePrice(region),
    ]);
    const cards = ((data ?? []) as WallpaperRow[]).map((row) => toCard(row, region, fallback));
    return ids.map((id) => cards.find((c) => c.id === id)).filter(Boolean) as WallpaperCard[];
  } catch {
    return [];
  }
}

/**
 * Find a published wallpaper from a /w/[param] value: by its permanent code
 * when the URL has one (/w/<slug>-<code>), else by slug (older links).
 */
export async function getWallpaperBySlug(
  param: string,
  region: RegionCode,
): Promise<WallpaperCard | null> {
  const { code, slug } = parseWallpaperParam(param);
  if (!(await catalogueLive())) return demoWallpaperBySlug(slug, region, code) ?? (code ? demoWallpaperBySlug(param, region) : null);
  try {
    const db = await createClient();
    const lookup = (by: 'code' | 'slug', v: string) =>
      db.from('wallpapers').select(CARD_SELECT).eq(by, v).eq('status', 'published').maybeSingle();
    const [first, fallback] = await Promise.all([code ? lookup('code', code) : lookup('slug', slug), globalBasePrice(region)]);
    // A slug that merely looks like it ends in a code: try it as a plain slug.
    const { data, error } = !first.data && code ? await lookup('slug', decodeURIComponent(param).toLowerCase()) : first;
    if (error || !data) return null;
    return toCard(data as WallpaperRow, region, fallback);
  } catch {
    return null;
  }
}

/** Categories with a count of their published wallpapers (real, not invented). */
export async function listCategories(): Promise<Category[]> {
  if (!(await catalogueLive())) {
    const demo = demoWallpapers(DEFAULT_REGION);
    return DEMO_CATEGORIES.map((c) => ({ ...c, count: demo.filter((w) => w.category_id === c.id).length }));
  }
  try {
    const supabase = (await createClient());
    const [{ data, error }, { data: rows }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('wallpapers').select('category_id').eq('status', 'published'),
    ]);
    if (error || !data) return [];
    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      if (r.category_id) counts.set(r.category_id as string, (counts.get(r.category_id as string) ?? 0) + 1);
    }
    return (data as Category[]).map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!(await catalogueLive())) return DEMO_CATEGORIES.find((c) => c.slug === slug) ?? null;
  try {
    const supabase = (await createClient());
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
  name: string | null;
  region_code: string;
  country_codes: string[];
  currency: string;
  amount_minor: number;
  credits: number;
  bonus_credits: number;
  badge: 'recommended' | 'best_value' | null;
  sort_order: number;
  active: boolean;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
}

/**
 * Active credit packs for a price context: the country's own prices where the
 * owner set them (e.g. GBP for the UK), otherwise the tier's prices.
 */
export async function listCreditPacks(ctx: PriceContext | RegionCode): Promise<CreditPack[]> {
  if (!dbConfigured()) return [];
  const c: PriceContext = typeof ctx === 'string' ? { region: ctx, country: null } : ctx;
  try {
    const { data, error } = await (await createClient())
      .from('credit_packs')
      .select('*')
      .eq('region_code', c.region)
      .eq('active', true);
    if (error || !data) return [];
    // Off-sale rows (festival windows) are dropped before choosing, so a
    // country's expired offer falls back to the tier's regular pack.
    return pickPricePoints((data as CreditPack[]).filter((p) => isOnSale(p)), c, (p) => p.name ?? p.id).sort(
      (a, b) => a.sort_order - b.sort_order || a.credits - b.credits,
    );
  } catch {
    return [];
  }
}

export async function getSetBySlug(slug: string): Promise<WallpaperSet | null> {
  if (!dbConfigured()) return null;
  try {
    const supabase = (await createClient());
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

/** Published wallpapers in a set. */
export async function listSetWallpapers(setId: string, region: RegionCode): Promise<WallpaperCard[]> {
  if (!(await catalogueLive())) return [];
  try {
    const [{ data }, fallback] = await Promise.all([
      (await createClient())
        .from('wallpapers')
        .select(CARD_SELECT)
        .eq('set_id', setId)
        .eq('status', 'published')
        .order('created_at', { ascending: true }),
      globalBasePrice(region),
    ]);
    return ((data ?? []) as WallpaperRow[]).map((row) => toCard(row, region, fallback));
  } catch {
    return [];
  }
}

/** All sets that have at least one published wallpaper (home bundles strip). */
export async function listSets(): Promise<(WallpaperSet & { count: number })[]> {
  if (!(await catalogueLive())) return [];
  try {
    const supabase = (await createClient());
    const [{ data: sets }, { data: rows }] = await Promise.all([
      supabase.from('wallpaper_sets').select('*'),
      supabase.from('wallpapers').select('set_id').eq('status', 'published').not('set_id', 'is', null),
    ]);
    const counts = new Map<string, number>();
    for (const r of rows ?? []) counts.set(r.set_id as string, (counts.get(r.set_id as string) ?? 0) + 1);
    return ((sets ?? []) as WallpaperSet[])
      .map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }))
      .filter((s) => s.count > 0);
  } catch {
    return [];
  }
}
