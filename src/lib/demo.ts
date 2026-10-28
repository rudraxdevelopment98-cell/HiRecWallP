import { REGION_PRICING_UNIT, type RegionCode } from '@/lib/geo';
import type { Category, WallpaperCard } from '@/types/catalogue';

/**
 * Built-in demo catalogue. Used as a graceful fallback when Supabase isn't
 * configured, so the site renders fully populated for previews/design review.
 * Photos are license-free scenics in /public/demo. Real data replaces this
 * once the DB is wired.
 */

interface DemoDef {
  slug: string;
  title: string;
  img: string;
  category: string;
  tags: string[];
  free: boolean;
  inr: number;
  credits: number;
  resolution: '4K' | '5K' | '8K';
  rating: number;
  reviews: number;
}

const DEFS: DemoDef[] = [
  { slug: 'alpine-serenity', title: 'Alpine Serenity', img: 'scene-1016', category: 'mountains', tags: ['mountain', 'lake', 'calm'], free: false, inr: 49, credits: 3, resolution: '8K', rating: 4.9, reviews: 124 },
  { slug: 'misty-highlands', title: 'Misty Highlands', img: 'scene-1018', category: 'mountains', tags: ['highland', 'fog', 'green'], free: false, inr: 29, credits: 2, resolution: '5K', rating: 4.8, reviews: 98 },
  { slug: 'canyon-river', title: 'Canyon River', img: 'scene-1015', category: 'nature', tags: ['canyon', 'river'], free: false, inr: 29, credits: 2, resolution: '5K', rating: 4.7, reviews: 76 },
  { slug: 'forest-path', title: 'Forest Path', img: 'scene-1019', category: 'forest', tags: ['forest', 'trees'], free: true, inr: 0, credits: 0, resolution: '4K', rating: 4.6, reviews: 63 },
  { slug: 'open-waters', title: 'Open Waters', img: 'scene-1036', category: 'ocean', tags: ['ocean', 'sea'], free: false, inr: 19, credits: 1, resolution: '4K', rating: 4.5, reviews: 112 },
  { slug: 'hidden-falls', title: 'Hidden Falls', img: 'scene-1039', category: 'nature', tags: ['waterfall', 'green'], free: true, inr: 0, credits: 0, resolution: '8K', rating: 4.9, reviews: 143 },
  { slug: 'coastal-light', title: 'Coastal Light', img: 'scene-1057', category: 'ocean', tags: ['coast', 'light'], free: false, inr: 29, credits: 2, resolution: '5K', rating: 4.7, reviews: 69 },
  { slug: 'mountain-pass', title: 'Mountain Pass', img: 'scene-1058', category: 'mountains', tags: ['road', 'mountain'], free: false, inr: 19, credits: 1, resolution: '4K', rating: 4.6, reviews: 87 },
  { slug: 'blue-horizon', title: 'Blue Horizon', img: 'scene-1061', category: 'ocean', tags: ['waves', 'blue'], free: true, inr: 0, credits: 0, resolution: '4K', rating: 4.8, reviews: 94 },
  { slug: 'summit-view', title: 'Summit View', img: 'scene-1062', category: 'mountains', tags: ['summit', 'view'], free: false, inr: 49, credits: 3, resolution: '8K', rating: 4.9, reviews: 120 },
  { slug: 'golden-ridge', title: 'Golden Ridge', img: 'scene-1022', category: 'sunset', tags: ['sunset', 'ridge'], free: false, inr: 29, credits: 2, resolution: '5K', rating: 4.7, reviews: 58 },
  { slug: 'quiet-valley', title: 'Quiet Valley', img: 'scene-1047', category: 'minimal', tags: ['valley', 'minimal'], free: true, inr: 0, credits: 0, resolution: '4K', rating: 4.5, reviews: 51 },
];

// Category row (display). Thumbnails reuse demo photos.
export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-nature', slug: 'nature', name: 'Nature', parent_id: null, sort_order: 10, count: 1240, thumbUrl: '/demo/scene-1039.jpg' },
  { id: 'cat-mountains', slug: 'mountains', name: 'Mountains', parent_id: null, sort_order: 20, count: 980, thumbUrl: '/demo/scene-1018.jpg' },
  { id: 'cat-ocean', slug: 'ocean', name: 'Ocean', parent_id: null, sort_order: 30, count: 760, thumbUrl: '/demo/scene-1061.jpg' },
  { id: 'cat-forest', slug: 'forest', name: 'Forest', parent_id: null, sort_order: 40, count: 640, thumbUrl: '/demo/scene-1019.jpg' },
  { id: 'cat-sunset', slug: 'sunset', name: 'Sunset', parent_id: null, sort_order: 50, count: 520, thumbUrl: '/demo/scene-1022.jpg' },
  { id: 'cat-minimal', slug: 'minimal', name: 'Minimal', parent_id: null, sort_order: 60, count: 420, thumbUrl: '/demo/scene-1047.jpg' },
  { id: 'cat-sky', slug: 'sky', name: 'Sky', parent_id: null, sort_order: 70, count: 390, thumbUrl: '/demo/scene-1043.jpg' },
  { id: 'cat-desert', slug: 'desert', name: 'Desert', parent_id: null, sort_order: 80, count: 310, thumbUrl: '/demo/scene-1084.jpg' },
];

function priceFor(def: DemoDef, region: RegionCode): number | null {
  if (def.free) return null;
  return REGION_PRICING_UNIT[region] === 'money' ? def.inr : def.credits;
}

const CAT_NAME = new Map(DEMO_CATEGORIES.map((c) => [c.slug, c.name]));

function toCard(def: DemoDef, i: number, region: RegionCode): WallpaperCard {
  return {
    id: `demo-${i}`,
    slug: def.slug,
    title: def.title,
    description: `${def.title} — an ultra-HD wallpaper tuned for phone, desktop, tablet and ultrawide screens.`,
    alt_text: def.title,
    category_id: `cat-${def.category}`,
    tags: def.tags,
    is_free: def.free,
    status: 'published',
    is_ai_generated: false,
    human_edited: false,
    set_id: null,
    created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    previewUrl: `/demo/${def.img}.jpg`,
    price: priceFor(def, region),
    region,
    rating: def.rating,
    reviews: def.reviews,
    resolution: def.resolution,
    categoryName: CAT_NAME.get(def.category) ?? def.category,
  };
}

export function demoWallpapers(region: RegionCode): WallpaperCard[] {
  return DEFS.map((d, i) => toCard(d, i, region));
}

export function demoWallpaperBySlug(slug: string, region: RegionCode): WallpaperCard | null {
  const i = DEFS.findIndex((d) => d.slug === slug);
  return i === -1 ? null : toCard(DEFS[i]!, i, region);
}
