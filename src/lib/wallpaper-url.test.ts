import { describe, expect, it } from 'vitest';
import { CODE_RE, demoCode, parseWallpaperParam, wallpaperPath } from './wallpaper-url';

describe('wallpaper URLs', () => {
  it('builds canonical paths with the code', () => {
    expect(wallpaperPath({ slug: 'canyon-river', code: 'k3x9p2ab' })).toBe('/w/canyon-river-k3x9p2ab');
    expect(wallpaperPath({ slug: 'canyon-river', code: null })).toBe('/w/canyon-river');
  });
  it('parses code and slug, tolerating renamed slugs', () => {
    expect(parseWallpaperParam('canyon-river-k3x9p2ab')).toEqual({ code: 'k3x9p2ab', slug: 'canyon-river' });
    expect(parseWallpaperParam('old-title-k3x9p2ab').code).toBe('k3x9p2ab');
    expect(parseWallpaperParam('k3x9p2ab')).toEqual({ code: 'k3x9p2ab', slug: '' });
  });
  it('never mistakes words for codes', () => {
    expect(parseWallpaperParam('sunset-mountain')).toEqual({ code: null, slug: 'sunset-mountain' }); // 8 letters, no digit
    expect(parseWallpaperParam('canyon-river')).toEqual({ code: null, slug: 'canyon-river' });
    expect(parseWallpaperParam('alpha-k3x9p2a1')).toEqual({ code: null, slug: 'alpha-k3x9p2a1' }); // '1' not allowed
  });
  it('demo codes are valid and stable', () => {
    for (const s of ['alpine-serenity', 'canyon-river', 'forest-path', 'x']) {
      expect(CODE_RE.test(demoCode(s))).toBe(true);
      expect(demoCode(s)).toBe(demoCode(s));
    }
    expect(demoCode('a')).not.toBe(demoCode('b'));
  });
});
