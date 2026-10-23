/**
 * Region detection and pricing-region resolution.
 *
 * Regions mirror `supabase/seed/seed.sql`. Display region is derived from the
 * visitor's country (Vercel edge header) but, per security_requirements, the
 * region actually CHARGED is re-checked against billing/card country at
 * checkout and, on mismatch, the HIGHER-priced region is used (anti-arbitrage).
 */

export const REGION_CODES = ['IN', 'T1', 'T2', 'T3'] as const;
export type RegionCode = (typeof REGION_CODES)[number];

export type PricingUnit = 'money' | 'credits';

/** Static country → region map (fallback = T3). Mirrors the seed data. */
const COUNTRY_TO_REGION: Record<string, RegionCode> = {
  IN: 'IN',
  // T1
  GB: 'T1', US: 'T1', CA: 'T1', AU: 'T1', IE: 'T1',
  FR: 'T1', DE: 'T1', ES: 'T1', IT: 'T1', NL: 'T1', EU: 'T1',
  // T2
  AE: 'T2', SA: 'T2', QA: 'T2', KW: 'T2', JP: 'T2', KR: 'T2', SG: 'T2', HK: 'T2',
};

export const DEFAULT_REGION: RegionCode = 'T3';

/** Currency shown for a region by default (credit packs may override). */
export const REGION_CURRENCY: Record<RegionCode, string> = {
  IN: 'INR',
  T1: 'USD',
  T2: 'USD',
  T3: 'USD',
};

export const REGION_PRICING_UNIT: Record<RegionCode, PricingUnit> = {
  IN: 'money',
  T1: 'credits',
  T2: 'credits',
  T3: 'credits',
};

export function isRegionCode(value: string | null | undefined): value is RegionCode {
  return value != null && (REGION_CODES as readonly string[]).includes(value);
}

/** Map an ISO-3166-1 alpha-2 country code to a pricing region. */
export function regionForCountry(country: string | null | undefined): RegionCode {
  if (!country) return DEFAULT_REGION;
  return COUNTRY_TO_REGION[country.toUpperCase()] ?? DEFAULT_REGION;
}

/**
 * Resolve which region to CHARGE. If the display region and the billing region
 * differ, charge whichever is more expensive for this item. Prices are compared
 * in a shared numeric space provided by the caller (e.g. an INR-equivalent),
 * since money and credit regions are otherwise not directly comparable.
 */
export function resolveChargeRegion(
  displayRegion: RegionCode,
  billingRegion: RegionCode,
  priceComparable: Record<RegionCode, number | undefined>,
): RegionCode {
  if (displayRegion === billingRegion) return displayRegion;
  const a = priceComparable[displayRegion] ?? -Infinity;
  const b = priceComparable[billingRegion] ?? -Infinity;
  return b > a ? billingRegion : displayRegion;
}
