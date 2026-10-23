import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION,
  isRegionCode,
  regionForCountry,
  resolveChargeRegion,
} from './geo';

describe('regionForCountry', () => {
  it('maps India to IN', () => {
    expect(regionForCountry('IN')).toBe('IN');
  });

  it('maps tier-1 countries to T1', () => {
    expect(regionForCountry('GB')).toBe('T1');
    expect(regionForCountry('us')).toBe('T1'); // case-insensitive
  });

  it('maps tier-2 countries to T2', () => {
    expect(regionForCountry('JP')).toBe('T2');
  });

  it('falls back to the default region for unknown/missing countries', () => {
    expect(regionForCountry('ZZ')).toBe(DEFAULT_REGION);
    expect(regionForCountry(undefined)).toBe(DEFAULT_REGION);
    expect(regionForCountry(null)).toBe(DEFAULT_REGION);
  });
});

describe('isRegionCode', () => {
  it('accepts valid region codes only', () => {
    expect(isRegionCode('IN')).toBe(true);
    expect(isRegionCode('T3')).toBe(true);
    expect(isRegionCode('XX')).toBe(false);
    expect(isRegionCode(null)).toBe(false);
  });
});

describe('resolveChargeRegion (anti-arbitrage)', () => {
  it('returns the display region when it matches billing', () => {
    expect(resolveChargeRegion('IN', 'IN', { IN: 19, T1: 2, T2: 2, T3: 1 })).toBe('IN');
  });

  it('charges the higher-priced region on mismatch', () => {
    // Display T3 (cheap) but billing T1 (dearer) → charge T1.
    const comparable = { IN: 19, T1: 5, T2: 3, T3: 1 };
    expect(resolveChargeRegion('T3', 'T1', comparable)).toBe('T1');
    expect(resolveChargeRegion('T1', 'T3', comparable)).toBe('T1');
  });

  it('keeps the display region when billing price is unknown', () => {
    const comparable = { IN: 19, T1: 5, T2: undefined, T3: 1 } as Record<
      'IN' | 'T1' | 'T2' | 'T3',
      number | undefined
    >;
    expect(resolveChargeRegion('T1', 'T2', comparable)).toBe('T1');
  });
});
