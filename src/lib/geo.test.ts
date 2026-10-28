import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION,
  chargeRegionFor,
  isRegionCode,
  regionForCountry,
  resolveChargeRegion,
} from './geo';

describe('chargeRegionFor (billing mismatch → higher-priced tier)', () => {
  it('keeps the region when display and billing agree', () => {
    expect(chargeRegionFor('IN', 'IN')).toBe('IN');
  });
  it('charges international pricing when an Indian display region bills abroad', () => {
    expect(chargeRegionFor('IN', 'T1')).toBe('T1');
  });
  it('never lets billing lower the tier', () => {
    expect(chargeRegionFor('T1', 'T3')).toBe('T1');
    expect(chargeRegionFor('T1', 'IN')).toBe('T1');
  });
  it('raises a cheap display region to the billing tier', () => {
    expect(chargeRegionFor('T3', 'T2')).toBe('T2');
  });
});

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
