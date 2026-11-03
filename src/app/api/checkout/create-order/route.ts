import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getDisplayCountry, getDisplayRegion, listCreditPacks } from '@/lib/catalogue';
import { createServiceClient } from '@/lib/supabase/service';
import { getProvider } from '@/lib/payments';
import { chargeContext, type PriceContext } from '@/lib/geo';
import { isSameOrigin } from '@/lib/http';
import { getSettings } from '@/lib/settings';
import { getPlanOffer } from '@/lib/membership';
import { startAutopay } from '@/lib/subscriptions';
import type { CreditPack } from '@/lib/catalogue';

export const runtime = 'nodejs';

const country = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .transform((s) => s.toUpperCase())
  .optional();

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('credit_pack'), creditPackId: z.string().uuid(), billingCountry: country }),
  z.object({
    type: z.literal('membership'),
    planId: z.string().uuid(),
    billing: z.enum(['prepaid', 'autopay']).default('prepaid'),
    billingCountry: country,
  }),
]);

const providerFor = (currency: string) => (currency === 'INR' ? 'razorpay' : 'razorpay_intl');

/**
 * Create a provider order for a credit pack or a membership. Prices are
 * recomputed server-side for the CHARGED context — the higher-priced tier of
 * display vs billing country, with that country's own prices when it has them —
 * so a VPN can't buy cheaper. Credits/passes are granted only by the webhook.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });

  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const raw = (await request.json().catch(() => null)) as { type?: unknown } | null;
  // Wallpapers are always bought with credits now (/api/credits/unlock-cart).
  if (raw?.type === 'wallpaper' || raw?.type === 'cart') {
    return NextResponse.json({ error: 'Wallpapers are unlocked with credits.', code: 'use_credits' }, { status: 409 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const body = parsed.data;

  const settings = await getSettings();
  if (!settings.store_open) {
    return NextResponse.json({ error: 'The store is temporarily closed. Please try again soon.', code: 'store_closed' }, { status: 503 });
  }

  const [displayRegion, displayCountry] = await Promise.all([getDisplayRegion(), getDisplayCountry()]);
  const billingCountry = body.billingCountry ?? null;
  const ctx: PriceContext = chargeContext(displayCountry, displayRegion, billingCountry, settings.country_tiers);
  const supabase = createServiceClient();

  try {
    // --- Credit pack -------------------------------------------------------
    if (body.type === 'credit_pack') {
      const { data: pack } = await supabase
        .from('credit_packs')
        .select('*')
        .eq('id', body.creditPackId)
        .eq('active', true)
        .maybeSingle();
      const allowed: CreditPack[] = await listCreditPacks(ctx);
      if (!pack || !allowed.some((p) => p.id === pack.id)) {
        // The pack isn't priced for where they'll be billed: send the right packs.
        return NextResponse.json(
          {
            error: 'Prices changed for your billing country — please pick a pack again.',
            code: 'region_mismatch',
            chargeRegion: ctx.region,
            packs: allowed,
          },
          { status: 409 },
        );
      }

      const provider = providerFor(pack.currency as string);
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          provider,
          status: 'created',
          currency: pack.currency,
          amount_minor: pack.amount_minor,
          billing_country: billingCountry ?? displayCountry,
        })
        .select('id')
        .single();
      if (orderErr || !order) throw orderErr ?? new Error('order insert failed');
      await supabase.from('order_items').insert({ order_id: order.id, credit_pack_id: pack.id });

      const total = Number(pack.credits) + Number(pack.bonus_credits ?? 0);
      const providerOrder = await getProvider(provider).createOrder({
        amountMinor: pack.amount_minor as number,
        currency: pack.currency as string,
        receipt: order.id,
        notes: { orderId: order.id, userId: user.id, credits: String(total) },
      });
      await supabase.from('orders').update({ provider_order_id: providerOrder.providerOrderId }).eq('id', order.id);
      return NextResponse.json({ orderId: order.id, checkout: providerOrder.checkout, credits: total });
    }

    // --- Membership --------------------------------------------------------
    if (!settings.membership_enabled) {
      return NextResponse.json({ error: 'Memberships are not on sale right now.' }, { status: 409 });
    }
    const offer = await getPlanOffer(body.planId, ctx);
    const price = offer ? (body.billing === 'autopay' ? offer.autopay : offer.prepaid) : null;
    if (!offer || !price) {
      return NextResponse.json({ error: 'This plan is not available for your billing country.' }, { status: 400 });
    }

    if (body.billing === 'autopay') {
      const started = await startAutopay(user.id, offer, billingCountry ?? displayCountry);
      return NextResponse.json({ subscriptionId: started.subscriptionId, checkout: started.checkout, amountMinor: started.amountMinor, currency: started.currency, totalCount: started.totalCount });
    }

    const provider = providerFor(price.currency);
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        provider,
        status: 'created',
        currency: price.currency,
        amount_minor: price.amount_minor,
        billing_country: billingCountry ?? displayCountry,
      })
      .select('id')
      .single();
    if (orderErr || !order) throw orderErr ?? new Error('order insert failed');
    await supabase.from('order_items').insert({ order_id: order.id, membership_plan_id: offer.plan.id, plan_price_id: price.id });

    const providerOrder = await getProvider(provider).createOrder({
      amountMinor: price.amount_minor,
      currency: price.currency,
      receipt: order.id,
      notes: { orderId: order.id, userId: user.id, plan: offer.plan.name },
    });
    await supabase.from('orders').update({ provider_order_id: providerOrder.providerOrderId }).eq('id', order.id);
    return NextResponse.json({ orderId: order.id, checkout: providerOrder.checkout, amountMinor: price.amount_minor, currency: price.currency });
  } catch (err) {
    console.error('[create-order]', err);
    return NextResponse.json({ error: 'Checkout unavailable' }, { status: 503 });
  }
}
