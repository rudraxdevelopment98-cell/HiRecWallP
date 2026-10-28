import 'server-only';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { REGION_PRICING_UNIT, type RegionCode } from '@/lib/geo';
import { loadSellable, priceItems, resolveCreditRegion, type Licence } from '@/lib/pricing';

export interface UnlockItem {
  wallpaperId: string;
  licence: Licence;
}

/**
 * Spend credits on one or more wallpapers. Costs use the user's credit region
 * (the highest tier they bought credits in, or the display region if higher),
 * items already owned cost nothing, and the total is checked against the
 * balance before anything is spent. Each spend is atomic in the database.
 */
export async function unlockWithCredits(
  userId: string,
  requested: UnlockItem[],
  displayRegion: RegionCode,
): Promise<NextResponse> {
  const creditRegion = await resolveCreditRegion(userId, displayRegion);
  if (REGION_PRICING_UNIT[creditRegion] === 'money') {
    return NextResponse.json(
      { error: 'This region pays per item; use checkout instead.', code: 'use_money', creditRegion },
      { status: 409 },
    );
  }

  const unique = [...new Map(requested.map((i) => [`${i.wallpaperId}:${i.licence}`, i])).values()];
  const sellable = await loadSellable(unique.map((i) => i.wallpaperId));
  if (unique.some((i) => !sellable.has(i.wallpaperId))) {
    return NextResponse.json({ error: 'One or more items are no longer available.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: owned } = await supabase
    .from('entitlements')
    .select('wallpaper_id, licence')
    .eq('user_id', userId)
    .in('wallpaper_id', unique.map((i) => i.wallpaperId));
  const ownedKeys = new Set((owned ?? []).map((e) => `${e.wallpaper_id}:${e.licence}`));
  const toBuy = unique.filter((i) => !ownedKeys.has(`${i.wallpaperId}:${i.licence}`));

  const priced = await priceItems(toBuy, creditRegion);
  if (!priced) return NextResponse.json({ error: 'Price unavailable' }, { status: 400 });
  const needed = priced.reduce((s, i) => s + i.price, 0);

  const { data: balanceRaw } = await supabase.rpc('credit_balance', { p_user: userId });
  const balance = Number(balanceRaw ?? 0);
  if (balance < needed) {
    return NextResponse.json(
      { error: 'Not enough credits', code: 'insufficient_credits', needed, balance, creditRegion },
      { status: 402 },
    );
  }

  const unlocked: string[] = [];
  for (const i of priced) {
    const { data: entitlementId, error } = await supabase.rpc('spend_credits_and_entitle', {
      p_user: userId,
      p_wallpaper: i.wallpaperId,
      p_cost: i.price,
      p_licence: i.licence,
    });
    if (error) throw error;
    if (!entitlementId) {
      // Balance changed underneath us (concurrent spend). Report what we got.
      return NextResponse.json(
        { error: 'Not enough credits', code: 'insufficient_credits', unlocked, creditRegion },
        { status: 402 },
      );
    }
    unlocked.push(i.wallpaperId);
  }

  return NextResponse.json({ ok: true, unlocked, spent: needed, alreadyOwned: unique.length - toBuy.length });
}
