import { describe, expect, it } from 'vitest';
import { categorySchema, packSchema, planPriceSchema, planSchema } from './admin-schemas';

describe('planSchema', () => {
  const base = {
    name: 'Plus · 6 months',
    description: '',
    kind: 'contract',
    term_months: 6,
    download_limit: 50,
    includes_commercial: false,
    category_id: '',
    badge: 'recommended',
    perks: ['a'],
    active: true,
    sort_order: 1,
  };
  it('derives duration from the term and normalises blanks', () => {
    const out = planSchema.parse(base);
    expect(out.duration_days).toBe(180);
    expect(out.description).toBeNull();
    expect(out.category_id).toBeNull();
    expect(out.badge).toBe('recommended');
  });
  it('requires a category for category passes', () => {
    expect(planSchema.safeParse({ ...base, kind: 'category' }).success).toBe(false);
    expect(planSchema.safeParse({ ...base, kind: 'category', category_id: '6b0ec698-1e22-4a82-bb41-8547209c88c6' }).success).toBe(true);
  });
  it('rejects silly terms', () => {
    expect(planSchema.safeParse({ ...base, term_months: 0 }).success).toBe(false);
  });
});

describe('packSchema / planPriceSchema', () => {
  it('parses country lists and clears the Razorpay plan id', () => {
    const pack = packSchema.parse({ name: 'Mega', region_code: 'T1', country_codes: 'gb, ie', currency: 'gbp', amount_minor: 1999, credits: 100, bonus_credits: null, badge: '', sort_order: null, active: true });
    expect(pack.country_codes).toEqual(['GB', 'IE']);
    expect(pack.currency).toBe('GBP');
    expect(pack.bonus_credits).toBe(0);
    expect(pack.badge).toBeNull();
    const price = planPriceSchema.parse({ plan_id: '6b0ec698-1e22-4a82-bb41-8547209c88c6', billing: 'autopay', region_code: 'IN', country_codes: '', currency: 'INR', amount_minor: 29900, active: true });
    expect(price.country_codes).toEqual([]);
    expect(price.provider_plan_id).toBeNull();
  });
  it('rejects bad countries and tiers', () => {
    expect(packSchema.safeParse({ name: 'x', region_code: 'T9', currency: 'USD', amount_minor: 1, credits: 1, active: true }).success).toBe(false);
    expect(planPriceSchema.safeParse({ plan_id: '6b0ec698-1e22-4a82-bb41-8547209c88c6', billing: 'prepaid', region_code: 'T1', country_codes: 'GBR', currency: 'GBP', amount_minor: 1, active: true }).success).toBe(false);
  });
});

describe('categorySchema', () => {
  it('requires a clean slug', () => {
    expect(categorySchema.safeParse({ name: 'X', slug: 'Bad Slug!', sort_order: 1 }).success).toBe(false);
    expect(categorySchema.parse({ name: 'X', slug: 'Good-Slug', sort_order: 1 }).slug).toBe('good-slug');
  });
});
