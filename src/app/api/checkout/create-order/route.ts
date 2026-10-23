import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getDisplayRegion } from '@/lib/catalogue';
import { createServiceClient } from '@/lib/supabase/service';
import { getProvider } from '@/lib/payments';
import { getRegionPrice, toMinorUnits } from '@/lib/pricing';
import { REGION_PRICING_UNIT } from '@/lib/geo';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.union([
  z.object({ type: z.literal('wallpaper'), wallpaperId: z.string().uuid() }),
  z.object({ type: z.literal('credit_pack'), creditPackId: z.string().uuid() }),
]);

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
  const supabase = createServiceClient();

  try {
    if (parsed.data.type === 'wallpaper') {
      // Per-item money purchase (India). Credit regions use /api/credits/unlock.
      if (REGION_PRICING_UNIT[region] !== 'money') {
        return NextResponse.json(
          { error: 'This region buys wallpapers with credits; use credit unlock.' },
          { status: 400 },
        );
      }
      const price = await getRegionPrice(parsed.data.wallpaperId, region);
      if (price == null) return NextResponse.json({ error: 'Price unavailable' }, { status: 400 });

      const amountMinor = toMinorUnits(price, region);
      const currency = 'INR';

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          provider: 'razorpay',
          status: 'created',
          currency,
          amount_minor: amountMinor,
        })
        .select('id')
        .single();
      if (orderErr || !order) throw orderErr ?? new Error('order insert failed');

      await supabase.from('order_items').insert({
        order_id: order.id,
        wallpaper_id: parsed.data.wallpaperId,
        unit_price: price,
      });

      // 15-minute price lock.
      await supabase.from('price_quotes').insert({
        user_id: user.id,
        wallpaper_id: parsed.data.wallpaperId,
        region_code: region,
        price,
      });

      const providerOrder = await getProvider('razorpay').createOrder({
        amountMinor,
        currency,
        receipt: order.id,
        notes: { orderId: order.id, userId: user.id },
      });

      await supabase
        .from('orders')
        .update({ provider_order_id: providerOrder.providerOrderId })
        .eq('id', order.id);

      return NextResponse.json({ orderId: order.id, checkout: providerOrder.checkout });
    }

    // Credit pack purchase (international) via Razorpay International cards.
    const { data: pack, error: packErr } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('id', parsed.data.creditPackId)
      .eq('active', true)
      .maybeSingle();
    if (packErr || !pack) return NextResponse.json({ error: 'Pack not found' }, { status: 400 });

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        provider: 'razorpay_intl',
        status: 'created',
        currency: pack.currency,
        amount_minor: pack.amount_minor,
      })
      .select('id')
      .single();
    if (orderErr || !order) throw orderErr ?? new Error('order insert failed');

    await supabase.from('order_items').insert({
      order_id: order.id,
      credit_pack_id: pack.id,
    });

    const providerOrder = await getProvider('razorpay_intl').createOrder({
      amountMinor: pack.amount_minor,
      currency: pack.currency,
      receipt: order.id,
      notes: { orderId: order.id, userId: user.id, credits: String(pack.credits) },
    });

    await supabase
      .from('orders')
      .update({ provider_order_id: providerOrder.providerOrderId })
      .eq('id', order.id);

    return NextResponse.json({ orderId: order.id, checkout: providerOrder.checkout });
  } catch {
    return NextResponse.json({ error: 'Checkout unavailable' }, { status: 503 });
  }
}
