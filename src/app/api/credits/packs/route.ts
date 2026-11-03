import { NextResponse } from 'next/server';
import { getDisplayCountry, getDisplayRegion, listCreditPacks } from '@/lib/catalogue';
import { chargeContext } from '@/lib/geo';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Credit packs priced for where the buyer will be charged: the higher-priced
 * tier of their display country and `?billingCountry=`, using that country's
 * own prices (e.g. GBP) when it has them.
 */
export async function GET(request: Request) {
  const billing = new URL(request.url).searchParams.get('billingCountry');
  const [region, country, settings] = await Promise.all([getDisplayRegion(), getDisplayCountry(), getSettings()]);
  const ctx = chargeContext(country, region, billing, settings.country_tiers);
  const packs = await listCreditPacks(ctx);
  return NextResponse.json({ chargeRegion: ctx.region, country: ctx.country, packs });
}
