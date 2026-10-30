import { NextResponse } from 'next/server';
import { getDisplayRegion, listCreditPacks } from '@/lib/catalogue';
import { REGION_PRICING_UNIT, chargeRegionFor, regionForCountry } from '@/lib/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Credit packs for the region the buyer will actually be charged in: the
 * higher-priced of their display region and `?billingCountry=`.
 */
export async function GET(request: Request) {
  const billing = new URL(request.url).searchParams.get('billingCountry');
  const display = (await getDisplayRegion());
  const chargeRegion =
    billing && /^[A-Za-z]{2}$/.test(billing)
      ? chargeRegionFor(display, regionForCountry(billing.toUpperCase()))
      : display;
  if (REGION_PRICING_UNIT[chargeRegion] === 'money') {
    return NextResponse.json({ chargeRegion, packs: [] });
  }
  const packs = await listCreditPacks(chargeRegion);
  return NextResponse.json({ chargeRegion, packs });
}
