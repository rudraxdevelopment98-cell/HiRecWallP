import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { REGION_PRICING_UNIT, isRegionCode, chargeRegionFor, type RegionCode } from '@/lib/geo';

/**
 * Current price of a wallpaper in a region, in the region's unit
 * (rupees for money regions, whole credits for credit regions).
 *
 * Resolution order: the `prices` row for this wallpaper+region, else the
 * global `price_rules` base price for the region. Returns null if nothing
 * applies. Callers must check the wallpaper is sellable (see loadSellable).
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

/** Commercial licence price multiplier for a region (default 5). */
export async function commercialMultiplier(region: RegionCode): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('regions')
    .select('commercial_multiplier')
    .eq('code', region)
    .maybeSingle();
  return data?.commercial_multiplier != null ? Number(data.commercial_multiplier) : 5;
}

/**
 * The subset of `ids` that can be bought: published and not free. Guards
 * order creation so nobody can purchase drafts, archived or free items.
 */
export async function loadSellable(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('wallpapers')
    .select('id')
    .in('id', ids)
    .eq('status', 'published')
    .eq('is_free', false);
  return new Set((data ?? []).map((w) => w.id as string));
}

/**
 * The region whose credit costs apply when a user spends credits. Credits carry
 * the tier they were bought in: the highest-priced region among the user's paid
 * credit-pack purchases, or the display region if higher. Stops someone buying
 * credits with a Tier-1 card and spending them at Tier-3 rates via a VPN.
 */
export async function resolveCreditRegion(
  userId: string,
  displayRegion: RegionCode,
): Promise<RegionCode> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('orders')
    .select('order_items(credit_packs(region_code))')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .eq('provider', 'razorpay_intl')
    .returns<{ order_items: { credit_packs: { region_code: string } | null }[] }[]>();

  let region = displayRegion;
  for (const order of data ?? []) {
    for (const item of order.order_items ?? []) {
      const code = item.credit_packs?.region_code;
      if (isRegionCode(code)) region = chargeRegionFor(region, code);
    }
  }
  return region;
}

export type Licence = 'personal' | 'commercial';

/**
 * Price each (wallpaper, licence) pair in `region`, applying the commercial
 * multiplier. Credit regions round up to whole credits. Returns null if any
 * item has no applicable price.
 */
export async function priceItems<T extends { wallpaperId: string; licence: Licence }>(
  items: T[],
  region: RegionCode,
): Promise<(T & { price: number })[] | null> {
  const mult = items.some((i) => i.licence === 'commercial') ? await commercialMultiplier(region) : 1;
  const round = REGION_PRICING_UNIT[region] === 'money' ? Math.round : Math.ceil;
  const out: (T & { price: number })[] = [];
  for (const i of items) {
    const base = await getRegionPrice(i.wallpaperId, region);
    if (base == null) return null;
    out.push({ ...i, price: i.licence === 'commercial' ? round(base * mult) : base });
  }
  return out;
}
