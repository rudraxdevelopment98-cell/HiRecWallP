import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/payouts', () => ({ getPayoutProvider: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getSettings: vi.fn() }));
const { toCsv } = await import('./tax-data');

describe('toCsv', () => {
  it('quotes and neutralises formula injection', () => {
    expect(toCsv(['a', 'b'], [['x,y', '=HYPERLINK("evil")'], [null, 3]])).toBe('a,b\n"x,y","\'=HYPERLINK(""evil"")"\n,3\n');
  });
});
