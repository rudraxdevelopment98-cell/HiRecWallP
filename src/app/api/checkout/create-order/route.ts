import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getDisplayRegion } from '@/lib/catalogue';
import { createServiceClient } from '@/lib/supabase/service';
import { getProvider } from '@/lib/payments';
import { loadSellable, priceItems, toMinorUnits } from '@/lib/pricing';
import {
  REGION_CURRENCY,
  REGION_PRICING_UNIT,
  REGION_RANK,
  chargeRegionFor,
  isRegionCode,
  regionForCountry,
  type RegionCode,
} from '@/lib/geo';
import { isSameOrigin } from '@/lib/http';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';

const licence = z.enum(['personal', 'commercial']).default('personal');
const country = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .transform((s) => s.toUpperCase())
  .optional();
const item = z.object({ wallpaperId: z.string().uuid(), licence });

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('wallpaper'), wallpaperId: z.string().uuid(), licence, billingCountry: country }),
  z.object({ type: z.literal('cart'), items: z.array(item).min(1).max(20), billingCountry: country }),
  z.object({ type: z.literal('credit_pack'), creditPackId: z.string().uuid(), billingCountry: country }),
  z.object({ type: z.literal('membership'), planId: z.string().uuid(), billingCountry: country }),
]);

/**
 * Create a provider order. Prices are always recomputed server-side; the client
 * total is never trusted. Display region comes from the geo cookie, but the
 * CHARGED region is the higher-priced of display vs billing country, so a VPN
 * can't buy at a cheaper tier. Entitlements/credits are granted only later, by
 * the verified webhook.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const settings = await getSettings();
  if (!settings.store_open) {
    return NextResponse.json({ error: 'The store is temporarily closed. Please try again soon.', code: 'store_closed' }, { status: 503 });
  }

  const displayRegion = getDisplayRegion();
  const billingCountry = parsed.data.billingCountry ?? null;
  const chargeRegion = billingCountry
    ? chargeRegionFor(displayRegion, regionForCountry(billingCountry))
    : displayRegion;
  const supabase = createServiceClient();

  try {
    // --- Credit pack (international) -------------------------------------
    if (parsed.data.type === 'credit_pack') {
      const { data: pack } = await supabase
        .from('credit_packs')
        .select('*')
        .eq('id', parsed.data.creditPackId)
        .eq('active', true)
        .maybeSingle();
      if (!pack || !isRegionCode(pack.region_code)) {
        return NextResponse.json({ error: 'Pack not found' }, { status: 400 });
      }
      if (REGION_RANK[pack.region_code as RegionCode] < REGION_RANK[chargeRegion]) {
        return NextResponse.json(
          { error: 'Please choose a credit pack for your billing region.', code: 'region_mismatch', chargeRegion },
          { status: 409 },
        );
      }

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          provider: 'razorpay_intl',
          status: 'created',
          currency: pack.currency,
          amount_minor: pack.amount_minor,
          billing_country: billingCountry,
        })
        .select('id')
        .single();
      if (orderErr || !order) throw orderErr ?? new Error('order insert failed');

      await supabase.from('order_items').insert({ order_id: order.id, credit_pack_id: pack.id });

      const providerOrder = await getProvider('razorpay_intl').createOrder({
        amountMinor: pack.amount_minor,
        currency: pack.currency,
        receipt: order.id,
        notes: { orderId: order.id, userId: user.id, credits: String(pack.credits) },
      });
      await supabase.from('orders').update({ provider_order_id: providerOrder.providerOrderId }).eq('id', order.id);

      return NextResponse.json({ orderId: order.id, checkout: providerOrder.checkout, credits: pack.credits });
    }

    // --- Membership pass ---------------------------------------------------
    if (parsed.data.type === 'membership') {
      if (!settings.membership_enabled) {
        return NextResponse.json({ error: 'Memberships are not on sale right now.' }, { status: 409 });
      }
      const { data: plan } = await supabase
        .from('membership_plans')
        .select('id, name, prices, active')
        .eq('id', parsed.data.planId)
        .eq('active', true)
        .maybeSingle();
      const amountMinor = plan ? (plan.prices as Record<string, number>)?.[chargeRegion] : undefined;
      if (!plan || typeof amountMinor !== 'number' || amountMinor <= 0) {
        return NextResponse.json({ error: 'This plan is not available for your billing country.' }, { status: 400 });
      }
      const money = REGION_PRICING_UNIT[chargeRegion] === 'money';
      const provider = money ? 'razorpay' : 'razorpay_intl';
      const currency = REGION_CURRENCY[chargeRegion];

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          provider,
          status: 'created',
          currency,
          amount_minor: amountMinor,
          billing_country: billingCountry,
        })
        .select('id')
        .single();
      if (orderErr || !order) throw orderErr ?? new Error('order insert failed');
      await supabase.from('order_items').insert({ order_id: order.id, membership_plan_id: plan.id });

      const providerOrder = await getProvider(provider).createOrder({
        amountMinor,
        currency,
        receipt: order.id,
        notes: { orderId: order.id, userId: user.id, plan: String(plan.name) },
      });
      await supabase.from('orders').update({ provider_order_id: providerOrder.providerOrderId }).eq('id', order.id);
      return NextResponse.json({ orderId: order.id, checkout: providerOrder.checkout, amountMinor, currency });
    }

    // --- Per-item wallpaper purchase (India, INR) ------------------------
    const requested =
      parsed.data.type === 'wallpaper'
        ? [{ wallpaperId: parsed.data.wallpaperId, licence: parsed.data.licence }]
        : parsed.data.items;

    if (REGION_PRICING_UNIT[chargeRegion] !== 'money') {
      return NextResponse.json(
        {
          error: 'International pricing applies to your billing country — unlock with credits instead.',
          code: 'use_credits',
          chargeRegion,
        },
        { status: 409 },
      );
    }

    const unique = [...new Map(requested.map((i) => [`${i.wallpaperId}:${i.licence}`, i])).values()];
    const sellable = await loadSellable(unique.map((i) => i.wallpaperId));
    if (unique.some((i) => !sellable.has(i.wallpaperId))) {
      return NextResponse.json({ error: 'One or more items are no longer available.' }, { status: 400 });
    }

    const priced = await priceItems(unique, chargeRegion);
    if (!priced) return NextResponse.json({ error: 'Price unavailable' }, { status: 400 });
    const amountMinor = priced.reduce((s, i) => s + toMinorUnits(i.price, chargeRegion), 0);
    const currency = 'INR';

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        provider: 'razorpay',
        status: 'created',
        currency,
        amount_minor: amountMinor,
        billing_country: billingCountry,
      })
      .select('id')
      .single();
    if (orderErr || !order) throw orderErr ?? new Error('order insert failed');

    await supabase.from('order_items').insert(
      priced.map((i) => ({ order_id: order.id, wallpaper_id: i.wallpaperId, unit_price: i.price, licence: i.licence })),
    );
    // 15-minute price lock per item.
    await supabase.from('price_quotes').insert(
      priced.map((i) => ({ user_id: user.id, wallpaper_id: i.wallpaperId, region_code: chargeRegion, price: i.price })),
    );

    const providerOrder = await getProvider('razorpay').createOrder({
      amountMinor,
      currency,
      receipt: order.id,
      notes: { orderId: order.id, userId: user.id, items: String(priced.length) },
    });
    await supabase.from('orders').update({ provider_order_id: providerOrder.providerOrderId }).eq('id', order.id);

    return NextResponse.json({ orderId: order.id, checkout: providerOrder.checkout, amountMinor, currency });
  } catch {
    return NextResponse.json({ error: 'Checkout unavailable' }, { status: 503 });
  }
}
