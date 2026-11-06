import { describe, expect, it } from 'vitest';
import { DEVICES, checkFitSize, fitFor, fittingDevices, qualityLabel, fitKey } from './fit';

describe('fitFor', () => {
  it('grades by how much the source must be enlarged', () => {
    expect(fitFor(5120, 2880, 3840, 2160).grade).toBe('sharp');
    expect(fitFor(3840, 2160, 4096, 2304).grade).toBe('good'); // ×1.067
    expect(fitFor(3840, 2160, 5120, 2880).grade).toBe('too_small'); // ×1.33
  });
  it('reports how much of the picture survives the crop', () => {
    expect(fitFor(3840, 2160, 1920, 1080).kept).toBeCloseTo(1);
    expect(fitFor(3840, 2160, 1080, 2400).kept).toBeLessThan(0.3); // landscape art on a phone
  });
});

describe('fittingDevices', () => {
  it('lists phones for portrait art and screens for landscape art', () => {
    const portrait = fittingDevices(2160, 3840);
    expect(portrait.some((d) => d.kind === 'phone')).toBe(true);
    expect(portrait.some((d) => d.kind === 'desktop')).toBe(false);
    const landscape = fittingDevices(5120, 2880);
    expect(landscape.some((d) => d.id === 'monitor-5k')).toBe(true);
    expect(landscape.some((d) => d.kind === 'phone')).toBe(false);
  });
  it('is empty without a source size', () => {
    expect(fittingDevices(0, 0)).toEqual([]);
  });
  it('catalogue entries are sane', () => {
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length);
    for (const d of DEVICES) expect(d.kind === 'desktop' ? d.w > d.h : d.h > d.w).toBe(true);
  });
});

describe('checkFitSize', () => {
  it('accepts a size the artwork covers', () => {
    expect(checkFitSize(1170, 2532, 2160, 3840)).toEqual({ ok: true, w: 1170, h: 2532 });
  });
  it('rejects non-integers, tiny, huge, odd shapes and too-small sources', () => {
    expect(checkFitSize(1170.5, 2532, 2160, 3840).ok).toBe(false);
    expect(checkFitSize(100, 200, 2160, 3840).ok).toBe(false);
    expect(checkFitSize(8000, 4000, 9000, 9000).ok).toBe(false);
    expect(checkFitSize(4000, 400, 9000, 9000).ok).toBe(false);
    expect(checkFitSize(5120, 2880, 3840, 2160).ok).toBe(false);
  });
  it('keeps free wallpapers below 4K-class sizes', () => {
    expect(checkFitSize(2560, 1440, 3840, 2160, { free: true }).ok).toBe(true);
    expect(checkFitSize(3840, 2160, 3840, 2160, { free: true }).ok).toBe(false);
  });
});

describe('qualityLabel / fitKey', () => {
  it('labels by the largest size', () => {
    expect(qualityLabel(5120)?.badge).toBe('5K');
    expect(qualityLabel(3840)?.badge).toBe('4K');
    expect(qualityLabel(2600)?.badge).toBe('QHD');
    expect(qualityLabel(null)).toBeNull();
  });
  it('builds the cache key', () => {
    expect(fitKey('abc', 1170, 2532)).toBe('fit/abc/1170x2532.jpg');
  });
});

describe('approxSource / screenForArt', async () => {
  const { approxSource, screenForArt } = await import('./fit');
  it('prefers the stored original size, else the largest generated size', () => {
    expect(approxSource(4000, 3000, ['desktop_4k'])).toEqual({ w: 4000, h: 3000 });
    expect(approxSource(null, null, ['desktop_4k', 'desktop_5k'])).toEqual({ w: 5120, h: 2880 });
    expect(approxSource(null, null, [])).toEqual({ w: 0, h: 0 });
  });
  it('turns the screen to match the artwork', () => {
    expect(screenForArt(390, 844, 3, true)).toEqual({ w: 1170, h: 2532 });
    expect(screenForArt(390, 844, 3, false)).toEqual({ w: 2532, h: 1170 });
    expect(screenForArt(1440, 900, 2, false)).toEqual({ w: 2880, h: 1800 });
  });
});
