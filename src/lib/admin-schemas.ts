import { z } from 'zod';
import { REGION_CODES } from '@/lib/geo';

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug: lowercase letters, numbers and dashes');

const badge = z
  .enum(['', 'recommended', 'best_value'])
  .default('')
  .transform((v) => (v === '' ? null : v));
const regionCode = z.enum(REGION_CODES);
/** "gb, ie" → ["GB","IE"]; blank → [] (= the whole tier). */
const countryList = z
  .union([z.string(), z.array(z.string())])
  .default('')
  .transform((v) => (Array.isArray(v) ? v : v.split(/[\s,]+/)).map((c) => c.trim().toUpperCase()).filter(Boolean))
  .refine((list) => list.every((c) => /^[A-Z]{2}$/.test(c)), 'Countries: 2-letter codes like GB, IE')
  .refine((list) => list.length <= 60, 'Too many countries');
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Currency like USD');
const optionalUuid = z
  .string()
  .default('')
  .transform((v) => v || null)
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), 'Invalid id');

export const planSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(200).transform((v) => v || null),
    kind: z.enum(['monthly', 'contract', 'category', 'business']),
    term_months: z.number().int().min(1).max(36),
    download_limit: z.number().int().min(1).max(100000),
    includes_commercial: z.boolean(),
    category_id: optionalUuid,
    badge,
    perks: z.array(z.string().max(80)).max(10),
    active: z.boolean(),
    sort_order: z.number().int().min(0).max(1000),
  })
  .refine((p) => p.kind !== 'category' || p.category_id, { message: 'Category passes need a category', path: ['category_id'] })
  // A plan lasts term_months × 30 days; the allowance refreshes every 30 days.
  .transform((p) => ({ ...p, duration_days: p.term_months * 30 }));

/**
 * One price for a plan in a tier (optionally only for some countries).
 * prepaid = the whole term, paid once; autopay = charged every month.
 * Saving clears the cached Razorpay plan id (Razorpay plans can't change
 * price), so the next autopay checkout creates a fresh one.
 */
export const planPriceSchema = z
  .object({
    plan_id: z.string().uuid(),
    billing: z.enum(['prepaid', 'autopay']),
    region_code: regionCode,
    country_codes: countryList,
    currency,
    amount_minor: z.number().int().positive(),
    active: z.boolean(),
  })
  .transform((p) => ({ ...p, provider_plan_id: null }));

export const packSchema = z.object({
  name: z.string().trim().min(1).max(40),
  region_code: regionCode,
  country_codes: countryList,
  currency,
  amount_minor: z.number().int().positive(),
  credits: z.number().int().positive().max(100000),
  bonus_credits: z.number().int().min(0).max(100000).nullable().transform((v) => v ?? 0),
  badge,
  sort_order: z.number().int().min(0).max(1000).nullable().transform((v) => v ?? 0),
  active: z.boolean(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug,
  sort_order: z.number().int().min(0).max(10000),
});

export const setSchema = z.object({
  title: z.string().trim().min(1).max(80),
  slug,
  description: z.string().trim().max(400).transform((v) => v || null),
});
