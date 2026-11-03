import type { RegionCode } from '@/lib/geo';

/** Format a money amount given in MINOR units (paise/cents). */
export function formatMoneyMinor(amountMinor: number, currency: string, locale = 'en'): string {
  const whole = amountMinor % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: whole && currency === 'INR' ? 0 : 2,
  }).format(amountMinor / 100);
}

/** Whole rupees, e.g. creator earnings ("₹1,240"). */
export function formatRupees(amount: number, locale = 'en-IN'): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "1 credit" / "3 credits". */
export function formatCredits(credits: number): string {
  return `${credits} ${credits === 1 ? 'credit' : 'credits'}`;
}

/**
 * A wallpaper's price for display. Every region prices wallpapers in credits
 * (what a credit costs differs per country), so the region no longer changes
 * the unit; it is kept for call-site compatibility.
 */
export function formatRegionPrice(price: number, _region?: RegionCode): string {
  return formatCredits(price);
}

/** Per-unit price, e.g. "₹7.11 / credit". */
export function formatPerUnit(amountMinor: number, units: number, currency: string, unit = 'credit'): string {
  if (units <= 0) return '';
  return `${formatMoneyMinor(Math.round(amountMinor / units), currency)} / ${unit}`;
}
