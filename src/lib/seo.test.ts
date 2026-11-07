import { describe, expect, it } from 'vitest';
import { breadcrumbLd, categoryIntro, faqLd, isFilteredListing, wallpaperDescription, wallpaperLd, wallpaperTitle, websiteLd } from './seo';

const w = { title: 'Liquid Gold', categoryName: 'Abstract', orientation: 'landscape' as const, max_long_edge: 3840, is_free: false, tags: ['gold', 'dark'], previewUrl: 'https://cdn/x.jpg' };

describe('titles and descriptions', () => {
  it('puts resolution and device in the title', () => {
    expect(wallpaperTitle(w)).toBe('Liquid Gold 4K Desktop Wallpaper');
    expect(wallpaperTitle({ ...w, orientation: 'portrait', max_long_edge: 5120, is_free: true })).toBe('Liquid Gold 5K Phone Wallpaper – Free Download');
  });
  it('writes a useful description under ~165 chars', () => {
    const d = wallpaperDescription(w);
    expect(d).toContain('4K');
    expect(d).toContain('abstract');
    expect(d.length).toBeLessThanOrEqual(165);
    expect(wallpaperDescription({ ...w, description: 'x'.repeat(400) }).length).toBeLessThanOrEqual(165);
  });
  it('category intro mentions the count', () => {
    expect(categoryIntro('Nature', 12)).toContain('12 nature wallpapers');
  });
});

describe('JSON-LD', () => {
  it('marks wallpapers as licensable images', () => {
    const ld = wallpaperLd('https://s', 'B', w, '/w/x-abc');
    expect(ld['@type']).toBe('ImageObject');
    expect(ld.license).toBe('https://s/licence');
    expect(ld.acquireLicensePage).toBe('https://s/w/x-abc');
    expect(ld.keywords).toBe('gold, dark');
  });
  it('builds breadcrumbs, search box and FAQ', () => {
    expect((breadcrumbLd('https://s', [{ name: 'Home', path: '/' }]).itemListElement as { item: string }[])[0]!.item).toBe('https://s/');
    expect(JSON.stringify(websiteLd('https://s', 'B'))).toContain('/search?q={search_term_string}');
    expect((faqLd([{ q: 'Q', a: 'A' }]).mainEntity as unknown[]).length).toBe(1);
  });
});

describe('isFilteredListing', () => {
  it('treats any filter as a duplicate listing, but not tracking tags', () => {
    expect(isFilteredListing({})).toBe(false);
    expect(isFilteredListing({ utm_source: 'ig' })).toBe(false);
    expect(isFilteredListing({ sort: 'oldest' })).toBe(true);
    expect(isFilteredListing({ q: '' })).toBe(false);
  });
});
