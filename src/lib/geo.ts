/**
 * Country detection → pricing tier, and price-point resolution.
 *
 * Everything is bought with CREDITS. What a credit (or a plan) costs depends on
 * the visitor's tier and, where the owner set one, a country-specific price in
 * local currency (e.g. GBP for the UK). Display country comes from the Vercel
 * geo header (middleware → `country` cookie); the price actually CHARGED is
 * re-checked against the billing country and, on mismatch, the HIGHER-priced
 * tier wins (anti-arbitrage). India is cheapest and INR prices are protected by
 * the webhook's foreign-card refund.
 */

export const REGION_CODES = ['IN', 'T1', 'T2', 'T3', 'T4'] as const;
export type RegionCode = (typeof REGION_CODES)[number];

export const REGION_LABEL: Record<RegionCode, string> = {
  IN: 'India',
  T1: 'Tier 1 — US, UK, Western Europe, ANZ, Canada',
  T2: 'Tier 2 — Gulf, East Asia, Southern Europe',
  T3: 'Tier 3 — Eastern Europe, Latin America, SE Asia',
  T4: 'Tier 4 — South Asia, Africa, emerging markets',
};

const TIERS: Record<Exclude<RegionCode, 'IN'>, string[]> = {
  T1: ['US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'CH', 'NO', 'SE', 'DK', 'FI', 'IS', 'LU', 'NL', 'DE', 'AT', 'BE', 'FR', 'LI', 'MC'],
  T2: ['JP', 'KR', 'SG', 'HK', 'TW', 'MO', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'IL', 'ES', 'IT', 'PT', 'GR', 'CY', 'MT', 'SI', 'EE', 'CZ', 'AD', 'SM', 'BN'],
  T3: [
    'PL', 'HU', 'RO', 'BG', 'HR', 'SK', 'LT', 'LV', 'RS', 'ME', 'MK', 'AL', 'BA', 'MD', 'UA', 'BY', 'RU', 'GE', 'AM', 'AZ', 'KZ', 'TR',
    'CN', 'MY', 'TH', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'EC', 'CR', 'PA', 'DO', 'JM', 'TT', 'BS', 'BB', 'PR', 'GT', 'SV',
    'ZA', 'BW', 'NA', 'MU', 'SC', 'MV', 'JO', 'LB', 'IQ', 'IR', 'MN',
  ],
  T4: [
    'PK', 'BD', 'NP', 'LK', 'BT', 'AF', 'MM', 'KH', 'LA', 'VN', 'PH', 'ID', 'TL', 'PG',
    'EG', 'MA', 'DZ', 'TN', 'LY', 'SD', 'NG', 'GH', 'KE', 'ET', 'TZ', 'UG', 'RW', 'ZM', 'ZW', 'MZ', 'MW', 'AO', 'CM', 'CI', 'SN', 'ML',
    'BF', 'NE', 'TD', 'BJ', 'TG', 'SL', 'LR', 'GN', 'MG', 'SO', 'CD', 'CG', 'GA', 'BI', 'ER', 'DJ', 'GM', 'GW', 'LS', 'SZ',
    'BO', 'HN', 'NI', 'VE', 'CU', 'HT', 'SY', 'YE', 'PS', 'KG', 'TJ', 'UZ', 'TM',
  ],
};

const COUNTRY_TO_REGION: Record<string, RegionCode> = { IN: 'IN' };
for (const [tier, countries] of Object.entries(TIERS)) {
  for (const c of countries) COUNTRY_TO_REGION[c] = tier as RegionCode;
}

/** Unknown countries (and no geo header) get Tier 3. */
export const DEFAULT_REGION: RegionCode = 'T3';

/** Default currency of each tier (country rows may override, e.g. GBP). */
export const REGION_CURRENCY: Record<RegionCode, string> = { IN: 'INR', T1: 'USD', T2: 'USD', T3: 'USD', T4: 'USD' };

/** Cheapest first. India lowest (INR + Indian cards only), then T4 → T1. */
export const REGION_RANK: Record<RegionCode, number> = { IN: 0, T4: 1, T3: 2, T2: 3, T1: 4 };

export function isRegionCode(value: string | null | undefined): value is RegionCode {
  return value != null && (REGION_CODES as readonly string[]).includes(value);
}

export function isCountryCode(value: string | null | undefined): value is string {
  return value != null && /^[A-Z]{2}$/.test(value) && value !== 'XX';
}

/** Normalise "us" / " US " → "US"; anything else → null. */
export function normaliseCountry(value: string | null | undefined): string | null {
  const v = value?.trim().toUpperCase();
  return isCountryCode(v) ? v : null;
}

/**
 * Map an ISO-3166-1 alpha-2 country to its tier. `overrides` (admin setting
 * `country_tiers`) can move a country to another tier.
 */
export function regionForCountry(
  country: string | null | undefined,
  overrides?: Partial<Record<string, RegionCode>> | null,
): RegionCode {
  const c = normaliseCountry(country);
  if (!c) return DEFAULT_REGION;
  const o = overrides?.[c];
  if (o && isRegionCode(o)) return o;
  return COUNTRY_TO_REGION[c] ?? DEFAULT_REGION;
}

/** Countries explicitly listed in each tier (for the admin country table). */
export function tierCountries(): Record<RegionCode, string[]> {
  return { IN: ['IN'], ...TIERS };
}

/**
 * Generic anti-arbitrage: of display vs billing, charge whichever is more
 * expensive according to `priceComparable`.
 */
export function resolveChargeRegion(
  displayRegion: RegionCode,
  billingRegion: RegionCode,
  priceComparable: Partial<Record<RegionCode, number>>,
): RegionCode {
  if (displayRegion === billingRegion) return displayRegion;
  const a = priceComparable[displayRegion] ?? -Infinity;
  const b = priceComparable[billingRegion] ?? -Infinity;
  return b > a ? billingRegion : displayRegion;
}

/** The higher-priced of two tiers (the one a mismatched buyer is charged). */
export function chargeRegionFor(display: RegionCode, billing: RegionCode): RegionCode {
  return resolveChargeRegion(display, billing, REGION_RANK);
}

export interface PriceContext {
  region: RegionCode;
  /** Country used for country-specific prices, or null (tier price only). */
  country: string | null;
}

/**
 * Where to price a purchase: the higher-priced tier of display vs billing
 * country. The country-specific price only applies when that country sits in
 * the charged tier (so a UK visitor billing in the US pays the US/T1 price, a
 * VPN "Pakistan" visitor billing in the UK pays the UK price).
 */
export function chargeContext(
  displayCountry: string | null,
  displayRegion: RegionCode,
  billingCountry: string | null | undefined,
  overrides?: Partial<Record<string, RegionCode>> | null,
): PriceContext {
  const billing = normaliseCountry(billingCountry);
  if (!billing) return { region: displayRegion, country: displayCountry };
  const billingRegion = regionForCountry(billing, overrides);
  const region = chargeRegionFor(displayRegion, billingRegion);
  if (region === billingRegion) return { region, country: billing };
  return { region, country: displayCountry && regionForCountry(displayCountry, overrides) === region ? displayCountry : null };
}

/** A row priced per tier with optional country overrides (credit packs, plan prices). */
export interface PricePoint {
  region_code: string;
  country_codes: string[] | null;
}

/**
 * Pick the rows that apply in `ctx`: rows listing the country win; otherwise
 * the tier-wide rows (empty country list) of the region. `key` groups rows
 * that are the same product (e.g. pack name, or plan id + billing).
 */
export function pickPricePoints<T extends PricePoint>(rows: T[], ctx: PriceContext, key: (row: T) => string): T[] {
  const byKey = new Map<string, { country?: T; tier?: T }>();
  for (const row of rows) {
    if (row.region_code !== ctx.region) continue;
    const k = key(row);
    const slot = byKey.get(k) ?? {};
    const countries = row.country_codes ?? [];
    if (countries.length === 0) slot.tier ??= row;
    else if (ctx.country && countries.includes(ctx.country)) slot.country ??= row;
    byKey.set(k, slot);
  }
  const out: T[] = [];
  for (const slot of byKey.values()) {
    const pick = slot.country ?? slot.tier;
    if (pick) out.push(pick);
  }
  return out;
}

/** English country name for display ("IN" → "India"). */
export function countryName(code: string | null | undefined): string {
  const c = normaliseCountry(code);
  if (!c) return 'your country';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) ?? c;
  } catch {
    return c;
  }
}

/** Countries for the country picker, sorted by name. */
export function allCountries(): { code: string; name: string }[] {
  const codes = Object.keys(COUNTRY_TO_REGION);
  return codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
}
