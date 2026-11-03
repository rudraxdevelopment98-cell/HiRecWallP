import { describe, expect, it } from 'vitest';
import { formatCredits, formatMoneyMinor, formatPerUnit, formatRegionPrice, formatRupees } from './format';

describe('formatMoneyMinor', () => {
  it('formats minor units as currency', () => {
    expect(formatMoneyMinor(299, 'GBP')).toBe('£2.99');
    expect(formatMoneyMinor(1899, 'USD')).toBe('$18.99');
  });
  it('drops paise for whole rupee prices', () => {
    expect(formatMoneyMinor(24900, 'INR')).toBe('₹249');
    expect(formatMoneyMinor(24950, 'INR')).toBe('₹249.50');
  });
});

describe('credits', () => {
  it('formats every region as a credit count', () => {
    expect(formatRegionPrice(1, 'IN')).toBe('1 credit');
    expect(formatRegionPrice(3, 'T2')).toBe('3 credits');
    expect(formatCredits(0)).toBe('0 credits');
  });
  it('per-unit price', () => {
    expect(formatPerUnit(24900, 35, 'INR')).toBe('₹7.11 / credit');
    expect(formatPerUnit(999, 0, 'USD')).toBe('');
  });
  it('rupees', () => {
    expect(formatRupees(1240)).toBe('₹1,240');
  });
});
