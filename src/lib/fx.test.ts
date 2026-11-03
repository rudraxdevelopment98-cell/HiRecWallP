import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/settings', () => ({ clearSettingsCache: vi.fn() }));
const { parseRates } = await import('./fx');

describe('parseRates', () => {
  it('inverts INR-base rates to ₹ per unit', () => {
    expect(parseRates({ rates: { USD: 0.0119, GBP: 0.00935, EUR: 0.011, AUD: 0.0182, CAD: 0.0164 } })).toEqual({
      USD: 84.03, GBP: 106.95, EUR: 90.91, AUD: 54.95, CAD: 60.98,
    });
  });
  it('rejects missing or implausible data', () => {
    expect(parseRates(null)).toBeNull();
    expect(parseRates({ rates: { USD: 0.0119 } })).toBeNull();
    expect(parseRates({ rates: { USD: 5, GBP: 0.009, EUR: 0.011, AUD: 0.018, CAD: 0.016 } })).toBeNull();
  });
});
