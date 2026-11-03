import { describe, expect, it } from 'vitest';
import { DEFAULT_TAX, computeTds, fyRange, gstThresholdStatus, presumptiveProfit, upcomingDeadlines } from './tax';

describe('fyRange', () => {
  it('uses April–March in India time', () => {
    expect(fyRange(new Date('2026-11-03T10:00:00Z')).label).toBe('2026-27');
    expect(fyRange(new Date('2026-03-31T18:00:00Z')).label).toBe('2025-26'); // 31 Mar 23:30 IST
    expect(fyRange(new Date('2026-03-31T18:31:00Z')).label).toBe('2026-27'); // 1 Apr 00:01 IST
    expect(fyRange(new Date('2026-11-03T10:00:00Z')).start.toISOString()).toBe('2026-03-31T18:30:00.000Z');
  });
});

describe('gstThresholdStatus', () => {
  it('warns early and flags registration', () => {
    expect(gstThresholdStatus(500_000, 2_000_000)).toEqual({ level: 'ok', pct: 25 });
    expect(gstThresholdStatus(1_600_000, 2_000_000).level).toBe('watch');
    expect(gstThresholdStatus(1_850_000, 2_000_000).level).toBe('soon');
    expect(gstThresholdStatus(2_000_000, 2_000_000).level).toBe('register');
  });
});

describe('computeTds', () => {
  const ind = { pan: 'ABCDE1234F', tax_resident: 'IN' as const, entity_type: 'individual' as const };
  const base = { grossSales: 0, affiliate: 0, fySalesBefore: 0, fyAffiliateBefore: 0, fyCommissionTdsBefore: 0 };
  it('small individual creators with PAN pay no sales TDS', () => {
    expect(computeTds({ ...base, creator: ind, grossSales: 10_000 }).tdsSales).toBe(0);
  });
  it('deducts 0.1% once FY sales pass the exemption, 5% without PAN', () => {
    expect(computeTds({ ...base, creator: ind, grossSales: 100_000, fySalesBefore: 450_000 }).tdsSales).toBe(100);
    const r = computeTds({ ...base, creator: { ...ind, pan: null }, grossSales: 10_000 });
    expect(r.tdsSales).toBe(500);
    expect(r.note).toContain('No PAN');
  });
  it('commission TDS starts above ₹20,000 with catch-up', () => {
    expect(computeTds({ ...base, creator: ind, affiliate: 5_000, fyAffiliateBefore: 10_000 }).tdsCommission).toBe(0);
    expect(computeTds({ ...base, creator: ind, affiliate: 15_000, fyAffiliateBefore: 10_000 }).tdsCommission).toBe(500); // 2% of 25k
    expect(computeTds({ ...base, creator: ind, affiliate: 5_000, fyAffiliateBefore: 25_000, fyCommissionTdsBefore: 500 }).tdsCommission).toBe(100);
  });
  it('does not automate non-residents', () => {
    const r = computeTds({ ...base, creator: { ...ind, tax_resident: 'foreign' }, grossSales: 1_000_000, affiliate: 50_000 });
    expect(r).toMatchObject({ tdsSales: 0, tdsCommission: 0 });
    expect(r.note).toContain('Non-resident');
  });
});

describe('misc', () => {
  it('presumptive profit is 6% of digital receipts', () => {
    expect(presumptiveProfit(1_000_000)).toBe(60_000);
  });
  it('lists upcoming deadlines in order', () => {
    const d = upcomingDeadlines(new Date('2026-11-03T10:00:00Z'), { ...DEFAULT_TAX, gst_registered: true }, true);
    expect(d.length).toBeGreaterThan(5);
    expect(d[0]!.date.getTime()).toBeLessThanOrEqual(d[1]!.date.getTime());
    expect(d.some((x) => x.title === 'Advance tax (presumptive scheme)')).toBe(true);
  });
});
