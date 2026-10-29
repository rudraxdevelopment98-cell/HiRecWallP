import { describe, expect, it } from 'vitest';
import { orientationOf, plannedSizes } from './imaging';

const names = (s: { variant: string }[]) => s.map((x) => x.variant);

describe('orientationOf', () => {
  it('classifies by aspect ratio', () => {
    expect(orientationOf(1440, 3120)).toBe('portrait');
    expect(orientationOf(7680, 4320)).toBe('landscape');
    expect(orientationOf(4096, 4096)).toBe('square');
  });
});

describe('plannedSizes', () => {
  it('portrait art gets phone/tablet only, never desktop crops', () => {
    const p = plannedSizes(4320, 7680);
    expect(names(p.paid)).toEqual(['phone', 'tablet']);
    expect(names(p.free)).toEqual(['free_phone']);
  });

  it('16:9 landscape gets 4K + 5K but not ultrawide', () => {
    const p = plannedSizes(7680, 4320);
    expect(names(p.paid)).toEqual(['desktop_4k', 'desktop_5k']);
    expect(names(p.free)).toEqual(['free_desktop']);
  });

  it('very wide art also gets ultrawide', () => {
    expect(names(plannedSizes(7680, 3240).paid)).toContain('ultrawide');
  });

  it('skips sizes that would need heavy upscaling', () => {
    // 4K landscape source: 5K would be a 1.33× upscale → skipped.
    expect(names(plannedSizes(3840, 2160).paid)).toEqual(['desktop_4k']);
    // Too small for anything paid.
    expect(plannedSizes(1200, 800).paid).toEqual([]);
  });
});
