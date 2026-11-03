import { describe, expect, it } from 'vitest';
import { fromIstInput, isOnSale, saleEndsLabel, toIstInput } from './sale-window';

describe('sale windows', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  it('respects start and end', () => {
    expect(isOnSale({}, now)).toBe(true);
    expect(isOnSale({ sale_starts_at: '2026-11-06T00:00:00Z' }, now)).toBe(false);
    expect(isOnSale({ sale_ends_at: '2026-11-05T12:00:00Z' }, now)).toBe(false);
    expect(isOnSale({ sale_starts_at: '2026-10-25T00:00:00Z', sale_ends_at: '2026-11-12T18:29:00Z' }, now)).toBe(true);
  });
  it('round-trips IST inputs and labels end dates', () => {
    expect(fromIstInput('2026-11-12T23:59')).toBe('2026-11-12T18:29:00.000Z');
    expect(toIstInput('2026-11-12T18:29:00.000Z')).toBe('2026-11-12T23:59');
    expect(fromIstInput('nope')).toBeNull();
    expect(saleEndsLabel({ sale_ends_at: '2026-11-12T18:29:00.000Z' })).toBe('12 Nov');
  });
});
