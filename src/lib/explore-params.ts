import type { ExploreFilters } from '@/types/catalogue';

export type SearchParams = { [key: string]: string | string[] | undefined };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const DEVICES = new Set(['Mobile', 'Tablet', 'Desktop', 'Ultrawide']);
const SORTS = new Set(['newest', 'oldest', 'title']);

/** Parse explore/collection query params into validated filters + page. */
export function parseExploreParams(sp: SearchParams): { filters: ExploreFilters; page: number } {
  const free = one(sp.free);
  const orientation = one(sp.orientation);
  const res = one(sp.res);
  const sort = one(sp.sort);
  const devices = many(sp.device).filter((d) => DEVICES.has(d));
  const filters: ExploreFilters = {
    category: one(sp.category) || undefined,
    free: free === '1' ? true : free === '0' ? false : undefined,
    q: one(sp.q)?.trim() || undefined,
    sort: sort && SORTS.has(sort) ? (sort as ExploreFilters['sort']) : 'newest',
    orientation: orientation === 'portrait' || orientation === 'landscape' ? orientation : undefined,
    resolution: res === '4K' || res === '5K' ? res : undefined,
    devices: devices.length ? devices : undefined,
  };
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? '1', 10) || 1);
  return { filters, page };
}
