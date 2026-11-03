import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION,
  chargeContext,
  chargeRegionFor,
  countryName,
  isRegionCode,
  normaliseCountry,
  pickPricePoints,
  strictestContext,
  regionForCountry,
  resolveChargeRegion,
} from './geo';

describe('regionForCountry', () => {
  it('maps countries to their tier', () => {
    expect(regionForCountry('IN')).toBe('IN');
    expect(regionForCountry('us')).toBe('T1');
    expect(regionForCountry('GB')).toBe('T1');
    expect(regionForCountry('JP')).toBe('T2');
    expect(regionForCountry('BR')).toBe('T3');
    expect(regionForCountry('PK')).toBe('T4');
    expect(regionForCountry('NG')).toBe('T4');
  });
  it('falls back to the default tier for unknown/missing countries', () => {
    expect(regionForCountry('ZZ')).toBe(DEFAULT_REGION);
    expect(regionForCountry(undefined)).toBe(DEFAULT_REGION);
    expect(regionForCountry('not-a-country')).toBe(DEFAULT_REGION);
  });
  it('applies admin overrides', () => {
    expect(regionForCountry('BR', { BR: 'T4' })).toBe('T4');
    expect(regionForCountry('BR', { BR: 'nope' as never })).toBe('T3');
  });
});

describe('chargeRegionFor (billing mismatch → higher-priced tier)', () => {
  it('keeps the tier when display and billing agree', () => {
    expect(chargeRegionFor('IN', 'IN')).toBe('IN');
  });
  it('never lets billing lower the tier', () => {
    expect(chargeRegionFor('T1', 'T4')).toBe('T1');
    expect(chargeRegionFor('T1', 'IN')).toBe('T1');
    expect(chargeRegionFor('T4', 'IN')).toBe('T4');
  });
  it('raises a cheap display tier to the billing tier', () => {
    expect(chargeRegionFor('IN', 'T1')).toBe('T1');
    expect(chargeRegionFor('T4', 'T2')).toBe('T2');
  });
  it('resolveChargeRegion uses the comparable prices', () => {
    expect(resolveChargeRegion('IN', 'T1', { IN: 1, T1: 4 })).toBe('T1');
    expect(resolveChargeRegion('T1', 'IN', { IN: 1, T1: 4 })).toBe('T1');
  });
});

describe('chargeContext', () => {
  it('uses the display country when no billing country is given', () => {
    expect(chargeContext('GB', 'T1', null)).toEqual({ region: 'T1', country: 'GB' });
  });
  it('VPN to a cheap country, billing in the UK → UK price', () => {
    expect(chargeContext('PK', 'T4', 'gb')).toEqual({ region: 'T1', country: 'GB' });
  });
  it('UK visitor billing in the US → US/T1 price', () => {
    expect(chargeContext('GB', 'T1', 'US')).toEqual({ region: 'T1', country: 'US' });
  });
  it('US visitor claiming Indian billing stays on T1 with the US price', () => {
    expect(chargeContext('US', 'T1', 'IN')).toEqual({ region: 'T1', country: 'US' });
  });
});

describe('pickPricePoints', () => {
  const rows = [
    { name: 'Starter', region_code: 'T1', country_codes: [], currency: 'USD' },
    { name: 'Starter', region_code: 'T1', country_codes: ['GB'], currency: 'GBP' },
    { name: 'Popular', region_code: 'T1', country_codes: [], currency: 'USD' },
    { name: 'Starter', region_code: 'T2', country_codes: [], currency: 'USD' },
  ];
  it('prefers the country row, falls back to the tier row per product', () => {
    const got = pickPricePoints(rows, { region: 'T1', country: 'GB' }, (r) => r.name);
    expect(got.map((r) => `${r.name}:${r.currency}`).sort()).toEqual(['Popular:USD', 'Starter:GBP']);
  });
  it('uses tier rows for other countries in the tier', () => {
    const got = pickPricePoints(rows, { region: 'T1', country: 'US' }, (r) => r.name);
    expect(got.map((r) => r.currency)).toEqual(['USD', 'USD']);
  });
  it('ignores other tiers', () => {
    expect(pickPricePoints(rows, { region: 'T2', country: null }, (r) => r.name)).toHaveLength(1);
  });
});

describe('misc', () => {
  it('validates codes and names countries', () => {
    expect(isRegionCode('T4')).toBe(true);
    expect(isRegionCode('XX')).toBe(false);
    expect(normaliseCountry(' in ')).toBe('IN');
    expect(normaliseCountry('IND')).toBeNull();
    expect(countryName('IN')).toBe('India');
  });
});

describe('strictestContext (no picking a cheaper country)', () => {
  it('a VPN to Pakistan with a US time zone pays US prices', () => {
    expect(strictestContext([null, 'PK', 'US'])).toEqual({ region: 'T1', country: 'US' });
  });
  it('an account locked to the UK stays on UK prices from a cheaper IP', () => {
    expect(strictestContext(['GB', 'BR', 'BR'])).toEqual({ region: 'T1', country: 'GB' });
  });
  it('India stays India when every signal agrees', () => {
    expect(strictestContext(['IN', 'IN', null])).toEqual({ region: 'IN', country: 'IN' });
  });
  it('ties keep the first (locked) country; no signals → default tier', () => {
    expect(strictestContext(['DE', 'US'])).toEqual({ region: 'T1', country: 'DE' });
    expect(strictestContext([null, undefined, 'nope'])).toEqual({ region: 'T3', country: null });
  });
});
