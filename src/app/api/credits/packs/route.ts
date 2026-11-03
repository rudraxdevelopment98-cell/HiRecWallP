import { NextResponse } from 'next/server';
import { getChargeContext, listCreditPacks } from '@/lib/catalogue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Credit packs priced for this buyer: the most expensive tier among their
 * locked account country, IP, time zone and `?billingCountry=`.
 */
export async function GET(request: Request) {
  const ctx = await getChargeContext(new URL(request.url).searchParams.get('billingCountry'));
  const packs = await listCreditPacks(ctx);
  return NextResponse.json({ chargeRegion: ctx.region, country: ctx.country, packs });
}
