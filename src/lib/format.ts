import type { RegionCode } from '@/lib/geo';
import { REGION_CURRENCY, REGION_PRICING_UNIT } from '@/lib/geo';

/** Format a money amount given in MINOR units (paise/cents). */
export function formatMoneyMinor(amountMinor: number, currency: string, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100);
}

/**
 * Format a wallpaper's price for display in a region.
 * - money regions (IN): `price` is in rupees → "₹19"
 * - credit regions (T1..T3): `price` is whole credits → "2 credits"
 */
export function formatRegionPrice(price: number, region: RegionCode, locale = 'en'): string {
  if (REGION_PRICING_UNIT[region] === 'money') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: REGION_CURRENCY[region],
      maximumFractionDigits: 0,
    }).format(price);
  }
  return `${price} ${price === 1 ? 'credit' : 'credits'}`;
}
