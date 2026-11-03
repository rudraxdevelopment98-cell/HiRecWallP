import { describe, expect, it } from 'vitest';
import { selfRefundDecision, type RefundFacts } from './refund-rules';

const now = new Date('2026-11-10T00:00:00Z');
const facts = (over: Partial<RefundFacts>): RefundFacts => ({
  status: 'paid',
  paid_at: '2026-11-05T00:00:00Z',
  has_payment_id: true,
  kind: 'credit_pack',
  pack_credits: 30,
  spends_since: 0,
  paid_balance: 30,
  gift_status: null,
  membership_used: null,
  membership_status: null,
  ...over,
});

describe('self-serve refunds', () => {
  it('refunds an unused credit pack within 14 days', () => {
    expect(selfRefundDecision(facts({}), now).eligible).toBe(true);
  });
  it('refuses a pack after 14 days, after any spend, or when the balance is short', () => {
    expect(selfRefundDecision(facts({ paid_at: '2026-10-20T00:00:00Z' }), now).eligible).toBe(false);
    expect(selfRefundDecision(facts({ spends_since: 1 }), now).eligible).toBe(false);
    expect(selfRefundDecision(facts({ paid_balance: 10 }), now).eligible).toBe(false);
  });
  it('gifts: only while unredeemed', () => {
    expect(selfRefundDecision(facts({ kind: 'gift', gift_status: 'pending' }), now).eligible).toBe(true);
    const d = selfRefundDecision(facts({ kind: 'gift', gift_status: 'redeemed' }), now);
    expect(d.eligible).toBe(false);
    expect(!d.eligible && d.reviewable).toBe(false);
  });
  it('pay-once passes: unused and within 7 days', () => {
    const pass = { kind: 'membership' as const, membership_status: 'active' as const, membership_used: 0 };
    expect(selfRefundDecision(facts(pass), now).eligible).toBe(true);
    expect(selfRefundDecision(facts({ ...pass, membership_used: 1 }), now).eligible).toBe(false);
    expect(selfRefundDecision(facts({ ...pass, paid_at: '2026-11-01T00:00:00Z' }), now).eligible).toBe(false);
  });
  it('autopay, unpaid, refunded and payment-less orders go to review or are refused', () => {
    expect(selfRefundDecision(facts({ kind: 'autopay' }), now).eligible).toBe(false);
    expect(selfRefundDecision(facts({ status: 'created' }), now).eligible).toBe(false);
    expect(selfRefundDecision(facts({ status: 'refunded' }), now).eligible).toBe(false);
    expect(selfRefundDecision(facts({ has_payment_id: false }), now).eligible).toBe(false);
  });
});
