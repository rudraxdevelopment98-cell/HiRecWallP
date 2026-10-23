import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { REGION_PRICING_UNIT, type RegionCode } from '@/lib/geo';

/**
 * Current price of a wallpaper in a region, in the region's unit
 * (rupees for money regions, whole credits for credit regions).
 *
 * Resolution order: the `prices` row for this wallpaper+region, else the
 * most-specific applicable `price_rules` base price (wallpaper > category >
 * global). Returns null if nothing applies.
 */
export async function getRegionPrice(
  wallpaperId: string,
  region: RegionCode,
): Promise<number | null> {
  const supabase = createServiceClient();

  const { data: priceRow } = await supabase
    .from('prices')
    .select('current_price')
    .eq('wallpaper_id', wallpaperId)
    .eq('region_code', region)
    .maybeSingle();
  if (priceRow?.current_price != null) return Number(priceRow.current_price);

  // Fall back to the global rule's base price for the region.
  const { data: rule } = await supabase
    .from('price_rules')
    .select('base_price')
    .eq('region_code', region)
    .eq('scope', 'global')
    .maybeSingle();
  return rule?.base_price != null ? Number(rule.base_price) : null;
}

/** Convert a region price to the currency's MINOR unit for a money region. */
export function toMinorUnits(price: number, region: RegionCode): number {
  if (REGION_PRICING_UNIT[region] !== 'money') {
    throw new Error('toMinorUnits is only valid for money regions');
  }
  return Math.round(price * 100);
}
