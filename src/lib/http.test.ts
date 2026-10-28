import { describe, expect, it } from 'vitest';
import { safeNextPath } from './http';

describe('safeNextPath', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNextPath('/checkout')).toBe('/checkout');
    expect(safeNextPath('/w/alpine-serenity?x=1')).toBe('/w/alpine-serenity?x=1');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeNextPath('https://evil.example')).toBe('/library');
    expect(safeNextPath('//evil.example')).toBe('/library');
    expect(safeNextPath('/\\evil.example')).toBe('/library');
  });

  it('falls back when missing', () => {
    expect(safeNextPath(null)).toBe('/library');
    expect(safeNextPath(undefined, '/')).toBe('/');
  });
});
