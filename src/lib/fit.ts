/**
 * Exact-fit sizes (B5). Pure helpers shared by the wallpaper page, the library
 * and /api/download: a device catalogue, how well an artwork fits a screen,
 * and validation of requested sizes. The crop itself happens server-side from
 * the private master (never exposed).
 */

export type DeviceKind = 'phone' | 'tablet' | 'desktop';

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  /** Native resolution in the orientation the wallpaper is used (phones/tablets portrait). */
  w: number;
  h: number;
}

/** Popular screens (resolution only — names are used to say "fits", nothing more). */
export const DEVICES: Device[] = [
  { id: 'iphone-16-pro-max', name: 'iPhone 16 Pro Max', kind: 'phone', w: 1320, h: 2868 },
  { id: 'iphone-16-pro', name: 'iPhone 16 Pro', kind: 'phone', w: 1206, h: 2622 },
  { id: 'iphone-16', name: 'iPhone 16 / 15', kind: 'phone', w: 1179, h: 2556 },
  { id: 'iphone-13', name: 'iPhone 13 / 14', kind: 'phone', w: 1170, h: 2532 },
  { id: 'iphone-se', name: 'iPhone SE', kind: 'phone', w: 750, h: 1334 },
  { id: 'galaxy-s25-ultra', name: 'Galaxy S25 Ultra', kind: 'phone', w: 1440, h: 3120 },
  { id: 'galaxy-s25', name: 'Galaxy S25', kind: 'phone', w: 1080, h: 2340 },
  { id: 'galaxy-a-series', name: 'Galaxy A series', kind: 'phone', w: 1080, h: 2340 },
  { id: 'pixel-9-pro', name: 'Pixel 9 Pro', kind: 'phone', w: 1280, h: 2856 },
  { id: 'pixel-9', name: 'Pixel 9', kind: 'phone', w: 1080, h: 2424 },
  { id: 'oneplus-13', name: 'OnePlus 13', kind: 'phone', w: 1440, h: 3168 },
  { id: 'redmi-note', name: 'Redmi Note series', kind: 'phone', w: 1220, h: 2712 },
  { id: 'phone-fhd', name: 'Full HD+ phone (20:9)', kind: 'phone', w: 1080, h: 2400 },
  { id: 'ipad-pro-13', name: 'iPad Pro 13″', kind: 'tablet', w: 2064, h: 2752 },
  { id: 'ipad-air-11', name: 'iPad Air 11″', kind: 'tablet', w: 1640, h: 2360 },
  { id: 'ipad-10', name: 'iPad (10th gen)', kind: 'tablet', w: 1640, h: 2360 },
  { id: 'galaxy-tab-s9', name: 'Galaxy Tab S9', kind: 'tablet', w: 1600, h: 2560 },
  { id: 'macbook-air-13', name: 'MacBook Air 13″', kind: 'desktop', w: 2560, h: 1664 },
  { id: 'macbook-pro-14', name: 'MacBook Pro 14″', kind: 'desktop', w: 3024, h: 1964 },
  { id: 'macbook-pro-16', name: 'MacBook Pro 16″', kind: 'desktop', w: 3456, h: 2234 },
  { id: 'imac-24', name: 'iMac 24″ (4.5K)', kind: 'desktop', w: 4480, h: 2520 },
  { id: 'monitor-5k', name: '5K monitor', kind: 'desktop', w: 5120, h: 2880 },
  { id: 'monitor-4k', name: '4K monitor', kind: 'desktop', w: 3840, h: 2160 },
  { id: 'monitor-qhd', name: 'QHD monitor (1440p)', kind: 'desktop', w: 2560, h: 1440 },
  { id: 'monitor-fhd', name: 'Full HD laptop / monitor', kind: 'desktop', w: 1920, h: 1080 },
  { id: 'laptop-16-10', name: '16:10 laptop (WUXGA)', kind: 'desktop', w: 1920, h: 1200 },
  { id: 'ultrawide-wqhd', name: 'Ultrawide 34″ (3440×1440)', kind: 'desktop', w: 3440, h: 1440 },
  { id: 'surface-pro', name: 'Surface Pro', kind: 'desktop', w: 2880, h: 1920 },
];

/** Same rule as the generated sizes: never enlarge the source more than this. */
export const MAX_FIT_UPSCALE = 1.15;
/** Free wallpapers never include 4K-class files (security requirement), so exact fits stay below this. */
export const FREE_FIT_MAX_LONG_EDGE = 2560;
export const FIT_MIN_SIDE = 320;
export const FIT_MAX_SIDE = 7680;

export type FitGrade = 'sharp' | 'good' | 'too_small';

export interface FitResult {
  grade: FitGrade;
  /** >1 means the source is enlarged. */
  scale: number;
  /** Share of the artwork kept after cropping to the screen's shape (1 = nothing cut). */
  kept: number;
}

/** How a source of srcW×srcH covers a w×h screen (cover crop, like the generated sizes). */
export function fitFor(srcW: number, srcH: number, w: number, h: number): FitResult {
  const scale = Math.max(w / srcW, h / srcH);
  const kept = Math.min((w / h) / (srcW / srcH), (srcW / srcH) / (w / h));
  const grade: FitGrade = scale <= 1 ? 'sharp' : scale <= MAX_FIT_UPSCALE ? 'good' : 'too_small';
  return { grade, scale, kept };
}

/**
 * Devices the artwork suits: sharp or good, and not a shape that would throw
 * away most of the picture (a wide landscape on a phone keeps under half).
 */
export function fittingDevices(srcW: number, srcH: number, minKept = 0.5): (Device & FitResult)[] {
  if (!srcW || !srcH) return [];
  return DEVICES.map((d) => ({ ...d, ...fitFor(srcW, srcH, d.w, d.h) })).filter((d) => d.grade !== 'too_small' && d.kept >= minKept);
}

export type FitCheck = { ok: true; w: number; h: number } | { ok: false; error: string };

/** Validate a requested exact-fit size against the source (and the free-wallpaper cap). */
export function checkFitSize(w: number, h: number, srcW: number, srcH: number, opts: { free?: boolean } = {}): FitCheck {
  if (!Number.isInteger(w) || !Number.isInteger(h)) return { ok: false, error: 'Size must be whole pixels' };
  if (Math.min(w, h) < FIT_MIN_SIDE || Math.max(w, h) > FIT_MAX_SIDE) return { ok: false, error: `Sizes from ${FIT_MIN_SIDE} to ${FIT_MAX_SIDE} px` };
  const ratio = w / h;
  if (ratio < 0.3 || ratio > 3.6) return { ok: false, error: 'That shape is too narrow' };
  if (opts.free && Math.max(w, h) > FREE_FIT_MAX_LONG_EDGE) return { ok: false, error: `Free wallpapers go up to ${FREE_FIT_MAX_LONG_EDGE} px` };
  if (!srcW || !srcH) return { ok: false, error: 'Source size unknown' };
  if (fitFor(srcW, srcH, w, h).grade === 'too_small') return { ok: false, error: 'This artwork is not big enough for that screen' };
  return { ok: true, w, h };
}

/** Plain-language quality label from the largest size we can deliver. */
export function qualityLabel(longEdge: number | null | undefined): { badge: string; label: string } | null {
  if (!longEdge) return null;
  if (longEdge >= 5120) return { badge: '5K', label: 'Ultra HD 5K' };
  if (longEdge >= 3840) return { badge: '4K', label: 'Ultra HD 4K' };
  if (longEdge >= 2560) return { badge: 'QHD', label: 'Quad HD' };
  return { badge: 'HD', label: 'HD' };
}

/** Storage key of a cached exact-fit crop. */
export const fitKey = (wallpaperId: string, w: number, h: number) => `fit/${wallpaperId}/${w}x${h}.jpg`;

const VARIANT_DIMS: Record<string, [number, number]> = {
  phone: [1440, 3120],
  tablet: [2048, 2732],
  desktop_4k: [3840, 2160],
  desktop_5k: [5120, 2880],
  ultrawide: [5120, 2160],
};

/** Source size for fit maths: the stored original size, else the largest generated size we know of. */
export function approxSource(srcW: number | null | undefined, srcH: number | null | undefined, variants: string[] = []): { w: number; h: number } {
  if (srcW && srcH) return { w: srcW, h: srcH };
  const best = variants.map((v) => VARIANT_DIMS[v]).filter(Boolean).sort((a, b) => b![0] * b![1] - a![0] * a![1])[0];
  return best ? { w: best[0], h: best[1] } : { w: 0, h: 0 };
}

/** The visitor's screen in device pixels, in the orientation that suits the artwork. */
export function screenForArt(screenW: number, screenH: number, dpr: number, artIsPortrait: boolean): { w: number; h: number } {
  const a = Math.round(screenW * dpr);
  const b = Math.round(screenH * dpr);
  const long = Math.max(a, b);
  const short = Math.min(a, b);
  return artIsPortrait ? { w: short, h: long } : { w: long, h: short };
}
