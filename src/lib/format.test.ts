import { describe, expect, it } from 'vitest';
import { formatMoneyMinor, formatRegionPrice } from './format';

describe('formatMoneyMinor', () => {
  it('formats minor units as currency', () => {
    expect(formatMoneyMinor(299, 'GBP')).toBe('£2.99');
    expect(formatMoneyMinor(1899, 'USD')).toBe('$18.99');
  });
});

describe('formatRegionPrice', () => {
  it('formats money regions with the currency symbol and no decimals', () => {
    expect(formatRegionPrice(19, 'IN')).toBe('₹19');
  });

  it('formats credit regions as a credit count', () => {
    expect(formatRegionPrice(1, 'T1')).toBe('1 credit');
    expect(formatRegionPrice(3, 'T2')).toBe('3 credits');
  });
});
