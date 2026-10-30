import { describe, expect, it } from 'vitest';
import { categorySchema, planSchema } from './admin-schemas';

describe('planSchema', () => {
  const base = {
    name: 'Monthly',
    description: '',
    duration_days: 30,
    price_in: 19900,
    price_t1: 699,
    price_t2: null,
    price_t3: 0,
    download_limit: 30,
    includes_commercial: false,
    perks: ['a'],
    active: true,
    sort_order: 1,
  };

  it('folds region prices into a prices map, dropping blanks/zero', () => {
    const out = planSchema.parse(base);
    expect(out.prices).toEqual({ IN: 19900, T1: 699 });
    expect(out.description).toBeNull();
    expect('price_in' in out).toBe(false);
  });

  it('rejects silly durations', () => {
    expect(planSchema.safeParse({ ...base, duration_days: 0 }).success).toBe(false);
  });
});

describe('categorySchema', () => {
  it('requires a clean slug', () => {
    expect(categorySchema.safeParse({ name: 'X', slug: 'Bad Slug!', sort_order: 1 }).success).toBe(false);
    expect(categorySchema.parse({ name: 'X', slug: 'Good-Slug', sort_order: 1 }).slug).toBe('good-slug');
  });
});
