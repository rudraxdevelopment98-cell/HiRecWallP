import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));

const { currentPeriod, passesFor } = await import('./membership');

describe('currentPeriod (mirrors member_unlock)', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  it('first period', () => {
    const p = currentPeriod(start, 30, new Date('2026-01-10T00:00:00Z'));
    expect(p.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
  it('rolls every 30 days', () => {
    const p = currentPeriod(start, 30, new Date('2026-03-05T00:00:00Z'));
    expect(p.start.toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });
});

describe('passesFor', () => {
  const base = { plan_name: 'x', kind: null, category_name: null, includes_commercial: false, starts_at: '2020-01-01T00:00:00Z', ends_at: '2999-01-01T00:00:00Z', resets_at: '', autopay: null } as const;
  const general = { ...base, id: 'g', category_id: null, allowance: 20, used_this_period: 3 };
  const nature = { ...base, id: 'n', category_id: 'nature', allowance: 30, used_this_period: 30 };
  it('category pass only covers its category; exhausted passes excluded', () => {
    expect(passesFor([general, nature], 'nature').map((p) => p.id)).toEqual(['g']);
    expect(passesFor([{ ...nature, used_this_period: 1 }], 'abstract')).toEqual([]);
    expect(passesFor([{ ...nature, used_this_period: 1 }], 'child', 'nature').map((p) => p.id)).toEqual(['n']);
  });
});
