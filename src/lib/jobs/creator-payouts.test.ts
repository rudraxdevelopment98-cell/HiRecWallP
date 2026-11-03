import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/payouts', () => ({ getPayoutProvider: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getSettings: vi.fn() }));

const { toInr } = await import('./creator-payouts');

describe('toInr', () => {
  it('converts with admin rates and rejects unknown currencies', () => {
    expect(toInr(2490, 'INR', {})).toBe(24.9);
    expect(toInr(99, 'USD', { USD: 84 })).toBe(83.16);
    expect(toInr(100, 'JPY', { USD: 84 })).toBeNull();
  });
});
