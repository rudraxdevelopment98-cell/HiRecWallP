import { REGION_PRICING_UNIT, type RegionCode } from '@/lib/geo';
import type { Category, WallpaperCard } from '@/types/catalogue';

/**
 * Built-in demo catalogue. Used as a graceful fallback when Supabase isn't
 * configured, so the site renders fully populated for previews/design review.
 * Images live in /public/demo. Real data replaces this once the DB is wired.
 */

interface DemoDef {
  slug: string;
  title: string;
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
  { slug: 'mahadev-cosmic-trishul', title: 'Cosmic Trishul', category: 'space', tags: ['cosmic', 'nebula', '4k'], free: false, inr: 49, credits: 3, resolution: '8K', rating: 4.9, reviews: 124 },
  { slug: 'amoled-void', title: 'AMOLED Void', category: 'dark', tags: ['amoled', 'dark', 'minimal'], free: true, inr: 0, credits: 0, resolution: '4K', rating: 4.7, reviews: 96 },
  { slug: 'nebula-drift', title: 'Nebula Drift', category: 'space', tags: ['space', 'nebula'], free: false, inr: 29, credits: 2, resolution: '5K', rating: 4.8, reviews: 76 },
  { slug: 'aurora-veil', title: 'Aurora Veil', category: 'nature', tags: ['aurora', 'green'], free: true, inr: 0, credits: 0, resolution: '4K', rating: 4.6, reviews: 63 },
  { slug: 'krishna-peacock', title: 'Peacock Dusk', category: 'abstract', tags: ['peacock', 'colour'], free: false, inr: 29, credits: 2, resolution: '5K', rating: 4.8, reviews: 88 },
  { slug: 'ember-ridge', title: 'Ember Ridge', category: 'nature', tags: ['sunset', 'mountain'], free: false, inr: 19, credits: 1, resolution: '4K', rating: 4.5, reviews: 112 },
  { slug: 'minimal-slate', title: 'Minimal Slate', category: 'minimal', tags: ['minimal', 'stone'], free: true, inr: 0, credits: 0, resolution: '4K', rating: 4.4, reviews: 51 },
  { slug: 'ganesha-gold', title: 'Golden Ganesha', category: 'abstract', tags: ['gold', 'festival'], free: false, inr: 49, credits: 3, resolution: '8K', rating: 4.9, reviews: 143 },
  { slug: 'midnight-wave', title: 'Midnight Wave', category: 'abstract', tags: ['wave', 'blue'], free: false, inr: 29, credits: 2, resolution: '5K', rating: 4.7, reviews: 69 },
  { slug: 'rose-obsidian', title: 'Rose Obsidian', category: 'dark', tags: ['rose', 'dark'], free: false, inr: 29, credits: 2, resolution: '4K', rating: 4.6, reviews: 87 },
  { slug: 'diwali-bloom', title: 'Diwali Bloom', category: 'abstract', tags: ['diwali', 'gold'], free: true, inr: 0, credits: 0, resolution: '4K', rating: 4.8, reviews: 94 },
  { slug: 'quartz-fog', title: 'Quartz Fog', category: 'minimal', tags: ['fog', 'grey'], free: false, inr: 19, credits: 1, resolution: '5K', rating: 4.5, reviews: 58 },
];

// Category row (display). Counts are illustrative; a thumbnail reuses a demo image.
export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-nature', slug: 'nature', name: 'Nature', parent_id: null, sort_order: 10, count: 1240, thumbUrl: '/demo/aurora-veil.jpg' },
  { id: 'cat-space', slug: 'space', name: 'Space', parent_id: null, sort_order: 20, count: 860, thumbUrl: '/demo/nebula-drift.jpg' },
  { id: 'cat-abstract', slug: 'abstract', name: 'Abstract', parent_id: null, sort_order: 30, count: 1420, thumbUrl: '/demo/midnight-wave.jpg' },
  { id: 'cat-dark', slug: 'dark', name: 'Black & Dark', parent_id: null, sort_order: 40, count: 780, thumbUrl: '/demo/amoled-void.jpg' },
  { id: 'cat-minimal', slug: 'minimal', name: 'Minimal', parent_id: null, sort_order: 50, count: 420, thumbUrl: '/demo/minimal-slate.jpg' },
  { id: 'cat-devotional', slug: 'devotional', name: 'Devotional', parent_id: null, sort_order: 60, count: 540, thumbUrl: '/demo/ganesha-gold.jpg' },
  { id: 'cat-festival', slug: 'festival', name: 'Festival', parent_id: null, sort_order: 70, count: 310, thumbUrl: '/demo/diwali-bloom.jpg' },
  { id: 'cat-gradient', slug: 'gradient', name: 'Gradient', parent_id: null, sort_order: 80, count: 650, thumbUrl: '/demo/rose-obsidian.jpg' },
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
    description: `${def.title} — an ultra-HD, AI-crafted wallpaper tuned for phone, desktop and tablet.`,
    alt_text: def.title,
    category_id: `cat-${def.category}`,
    tags: def.tags,
    is_free: def.free,
    status: 'published',
    is_ai_generated: true,
    human_edited: false,
    set_id: null,
    created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    previewUrl: `/demo/${def.slug}.jpg`,
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
