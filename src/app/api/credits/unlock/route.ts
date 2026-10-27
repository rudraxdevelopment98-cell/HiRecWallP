import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getDisplayRegion } from '@/lib/catalogue';
import { createServiceClient } from '@/lib/supabase/service';
import { getRegionPrice } from '@/lib/pricing';
import { REGION_PRICING_UNIT } from '@/lib/geo';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  wallpaperId: z.string().uuid(),
  licence: z.enum(['personal', 'commercial']).optional(),
});

/**
 * Spend credits to unlock a wallpaper (international regions). Atomic and
 * double-spend-safe via spend_credits_and_entitle. Returns 402 when the
 * balance is insufficient.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const region = getDisplayRegion();
  if (REGION_PRICING_UNIT[region] === 'money') {
    return NextResponse.json(
      { error: 'This region pays per item; use checkout instead.' },
      { status: 400 },
    );
  }

  try {
    const basePrice = await getRegionPrice(parsed.data.wallpaperId, region);
    if (basePrice == null) return NextResponse.json({ error: 'Price unavailable' }, { status: 400 });

    const supabase = createServiceClient();
    const licence = parsed.data.licence ?? 'personal';

    let cost = basePrice;
    if (licence === 'commercial') {
      const { data: regionRow } = await supabase
        .from('regions')
        .select('commercial_multiplier')
        .eq('code', region)
        .maybeSingle();
      cost = basePrice * (regionRow?.commercial_multiplier != null ? Number(regionRow.commercial_multiplier) : 5);
    }

    const { data: entitlementId, error } = await supabase.rpc('spend_credits_and_entitle', {
      p_user: user.id,
      p_wallpaper: parsed.data.wallpaperId,
      p_cost: Math.round(cost),
      p_licence: licence,
    });
    if (error) throw error;
    if (!entitlementId) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    return NextResponse.json({ ok: true, entitlementId });
  } catch {
    return NextResponse.json({ error: 'Unlock unavailable' }, { status: 503 });
  }
}
