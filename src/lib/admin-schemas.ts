import { z } from 'zod';

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug: lowercase letters, numbers and dashes');
const minor = z.number().int().nonnegative().nullable();

export const planSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(200).transform((v) => v || null),
    duration_days: z.number().int().min(1).max(3660),
    price_in: minor,
    price_t1: minor,
    price_t2: minor,
    price_t3: minor,
    download_limit: z.number().int().min(1).max(100000),
    includes_commercial: z.boolean(),
    perks: z.array(z.string().max(80)).max(10),
    active: z.boolean(),
    sort_order: z.number().int().min(0).max(1000),
  })
  .transform(({ price_in, price_t1, price_t2, price_t3, ...rest }) => {
    const prices: Record<string, number> = {};
    if (price_in) prices.IN = price_in;
    if (price_t1) prices.T1 = price_t1;
    if (price_t2) prices.T2 = price_t2;
    if (price_t3) prices.T3 = price_t3;
    return { ...rest, prices };
  });

export const packSchema = z.object({
  region_code: z.enum(['IN', 'T1', 'T2', 'T3']),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Currency like USD'),
  amount_minor: z.number().int().positive(),
  credits: z.number().int().positive().max(100000),
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
