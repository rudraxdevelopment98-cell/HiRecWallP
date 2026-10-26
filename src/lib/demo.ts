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
  inr: number; // rupee price for money regions
  credits: number; // credit price for credit regions
}

const DEFS: DemoDef[] = [
  { slug: 'mahadev-cosmic-trishul', title: 'Cosmic Trishul', category: 'devotional', tags: ['mahadev', 'cosmic', '4k'], free: false, inr: 49, credits: 3 },
  { slug: 'amoled-void', title: 'AMOLED Void', category: 'amoled-minimal', tags: ['amoled', 'dark', 'minimal'], free: true, inr: 0, credits: 0 },
  { slug: 'nebula-drift', title: 'Nebula Drift', category: 'abstract', tags: ['space', 'nebula'], free: false, inr: 29, credits: 2 },
  { slug: 'aurora-veil', title: 'Aurora Veil', category: 'nature', tags: ['aurora', 'green'], free: true, inr: 0, credits: 0 },
  { slug: 'krishna-peacock', title: 'Peacock Dusk', category: 'devotional', tags: ['krishna', 'peacock'], free: false, inr: 29, credits: 2 },
  { slug: 'ember-ridge', title: 'Ember Ridge', category: 'nature', tags: ['sunset', 'mountain'], free: false, inr: 19, credits: 1 },
  { slug: 'minimal-slate', title: 'Minimal Slate', category: 'amoled-minimal', tags: ['minimal', 'stone'], free: true, inr: 0, credits: 0 },
  { slug: 'ganesha-gold', title: 'Golden Ganesha', category: 'devotional', tags: ['ganesha', 'gold', 'festival'], free: false, inr: 49, credits: 3 },
  { slug: 'midnight-wave', title: 'Midnight Wave', category: 'abstract', tags: ['wave', 'blue'], free: false, inr: 29, credits: 2 },
  { slug: 'rose-obsidian', title: 'Rose Obsidian', category: 'abstract', tags: ['rose', 'dark'], free: false, inr: 29, credits: 2 },
  { slug: 'diwali-bloom', title: 'Diwali Bloom', category: 'festival', tags: ['diwali', 'festival', 'gold'], free: true, inr: 0, credits: 0 },
  { slug: 'quartz-fog', title: 'Quartz Fog', category: 'amoled-minimal', tags: ['fog', 'grey', 'minimal'], free: false, inr: 19, credits: 1 },
];

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-devotional', slug: 'devotional', name: 'Indian Devotional & Culture', parent_id: null, sort_order: 10 },
  { id: 'cat-festival', slug: 'festival', name: 'Festival Packs', parent_id: null, sort_order: 20 },
  { id: 'cat-amoled-minimal', slug: 'amoled-minimal', name: 'Dark AMOLED & Minimal', parent_id: null, sort_order: 30 },
  { id: 'cat-nature', slug: 'nature', name: 'Nature', parent_id: null, sort_order: 40 },
  { id: 'cat-abstract', slug: 'abstract', name: 'Abstract', parent_id: null, sort_order: 50 },
];

function priceFor(def: DemoDef, region: RegionCode): number | null {
  if (def.free) return null;
  return REGION_PRICING_UNIT[region] === 'money' ? def.inr : def.credits;
}

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
  };
}

export function demoWallpapers(region: RegionCode): WallpaperCard[] {
  return DEFS.map((d, i) => toCard(d, i, region));
}

export function demoWallpaperBySlug(slug: string, region: RegionCode): WallpaperCard | null {
  const i = DEFS.findIndex((d) => d.slug === slug);
  return i === -1 ? null : toCard(DEFS[i]!, i, region);
}
