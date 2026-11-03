import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getProvider } from '@/lib/payments';
import { getSettings } from '@/lib/settings';
import { handleSubscriptionEvent } from '@/lib/subscriptions';
import { sendGiftEmail } from '@/lib/gifts';

export const runtime = 'nodejs';

/**
 * Razorpay webhook. Entitlements and credits are granted ONLY here, after the
 * HMAC signature is verified, and processing is idempotent on the provider
 * event id (deduped via webhook_events). Client redirects never grant anything.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const provider = getProvider('razorpay');
  const result = provider.verifyWebhook(raw, headers);
  if (!result.verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Autopay: subscription.* events (monthly charges grant one month each).
  if (result.subscription) {
    const subEventId = result.providerEventId ?? `${result.subscription.providerSubscriptionId}:${result.eventType}:${result.paymentId ?? ''}`;
    const { error: subDupe } = await supabase.from('webhook_events').insert({ provider: 'razorpay', event_id: subEventId });
    if (subDupe) return NextResponse.json({ ok: true, duplicate: true });
    try {
      return NextResponse.json({ ok: true, ...(await handleSubscriptionEvent(result)) });
    } catch (err) {
      await supabase.from('webhook_events').delete().eq('provider', 'razorpay').eq('event_id', subEventId);
      console.error('[webhook] subscription processing failed', err);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  // Acknowledge non-payment events without side effects.
  if (!result.paid || !result.providerOrderId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Idempotency: record the event first; a duplicate insert means we already
  // handled it.
  const eventId = result.providerEventId ?? `${result.providerOrderId}:${result.eventType}`;
  const { error: dupeErr } = await supabase
    .from('webhook_events')
    .insert({ provider: 'razorpay', event_id: eventId });
  if (dupeErr) {
    // Unique violation → already processed.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    // Load the order this event refers to.
    const { data: order } = await supabase
      .from('orders')
      .select('id, user_id, status, provider, gift_email')
      .eq('provider_order_id', result.providerOrderId)
      .maybeSingle();
    if (!order) return NextResponse.json({ ok: true, unknownOrder: true });
    if (order.status !== 'created') return NextResponse.json({ ok: true, alreadyHandled: true });

    // INR prices are for India only. A foreign-issued card on an INR
    // order means someone bypassed region pricing: refund and grant nothing.
    if (order.provider === 'razorpay' && result.international) {
      if (result.paymentId) {
        try {
          await provider.refundPayment(result.paymentId, 'international card on INR pricing');
        } catch (err) {
          console.error('[webhook] refund failed', order.id, err);
        }
      }
      await supabase
        .from('orders')
        .update({ status: 'refunded', provider_payment_id: result.paymentId })
        .eq('id', order.id)
        .eq('status', 'created');
      return NextResponse.json({ ok: true, refunded: true });
    }

    // Claim the order atomically: only one concurrent event (payment.captured /
    // order.paid) gets to flip created → paid and grant.
    const { data: claimed } = await supabase
      .from('orders')
      .update({ status: 'paid', provider_payment_id: result.paymentId })
      .eq('id', order.id)
      .eq('status', 'created')
      .select('id');
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: true, alreadyHandled: true });

    // Sequential invoice number + buyer GSTIN snapshot for the receipt.
    await supabase.rpc('assign_invoice', { p_order: order.id });

    const { data: items } = await supabase
      .from('order_items')
      .select('wallpaper_id, set_id, credit_pack_id, membership_plan_id, licence')
      .eq('order_id', order.id);
    const maxDownloads = (await getSettings()).downloads_per_purchase;

    for (const item of items ?? []) {
      if (item.wallpaper_id) {
        await supabase.rpc('grant_entitlement', {
          p_user: order.user_id,
          p_wallpaper: item.wallpaper_id,
          p_order: order.id,
          p_licence: item.licence ?? 'personal',
          p_max_downloads: maxDownloads,
        });
      } else if (item.set_id) {
        // Expand the set into its wallpapers and grant each.
        const { data: inSet } = await supabase
          .from('wallpapers')
          .select('id')
          .eq('set_id', item.set_id);
        for (const w of inSet ?? []) {
          await supabase.rpc('grant_entitlement', {
            p_user: order.user_id,
            p_wallpaper: w.id,
            p_order: order.id,
            p_max_downloads: maxDownloads,
          });
        }
      } else if (item.membership_plan_id) {
        const { error: mErr } = await supabase.rpc('grant_membership', {
          p_user: order.user_id,
          p_plan: item.membership_plan_id,
          p_order: order.id,
        });
        if (mErr) throw mErr;
      } else if (item.credit_pack_id) {
        const { data: pack } = await supabase
          .from('credit_packs')
          .select('credits, bonus_credits, region_code')
          .eq('id', item.credit_pack_id)
          .maybeSingle();
        if (pack && order.gift_email) {
          // Gift: create a redeemable code for the friend instead of crediting the buyer.
          const { data: code, error: gErr } = await supabase.rpc('create_gift', { p_order: order.id, p_region: pack.region_code });
          if (gErr) throw gErr;
          await sendGiftEmail(order.id, code as string).catch((e) => console.error('[webhook] gift email failed', e));
        } else if (pack) {
          // Paid credits never expire; bonus credits expire after 12 months.
          const { error: cErr } = await supabase.rpc('add_pack_credits', {
            p_user: order.user_id,
            p_order: order.id,
            p_credits: pack.credits,
            p_bonus: pack.bonus_credits ?? 0,
            p_bonus_days: 365,
          });
          if (cErr) throw cErr;
        }
      }
    }

    // Growth: first-purchase bonus and creator affiliate commission (both idempotent).
    {
      const g = (await getSettings()).growth;
      if (g.first_purchase_bonus > 0) {
        await supabase.rpc('first_purchase_bonus', { p_order: order.id, p_credits: g.first_purchase_bonus, p_days: 365 });
      }
      if (g.affiliate_enabled && g.affiliate_pct > 0) {
        await supabase.rpc('record_affiliate_commission', { p_order: order.id, p_pct: g.affiliate_pct });
      }
    }

    // Lock the buyer's price country (first paid order only) and pay any
    // pending referral reward to whoever invited them.
    {
      const { data: paid } = await supabase.from('orders').select('billing_country').eq('id', order.id).maybeSingle();
      const g = (await getSettings()).growth;
      await supabase.rpc('after_paid_order', {
        p_order: order.id,
        p_country: (paid?.billing_country as string | null) ?? null,
        p_reward: g.referral_enabled ? g.referrer_reward : 0,
        p_monthly_cap: g.referral_enabled ? g.referral_monthly_cap : 0,
        p_days: g.reward_days,
      });
    }

    // Analytics: one purchase event per wallpaper line (funnel + best sellers).
    const bought = (items ?? []).filter((i) => i.wallpaper_id);
    if (bought.length) {
      await supabase
        .from('events')
        .insert(bought.map((i) => ({ type: 'purchase', user_id: order.user_id, wallpaper_id: i.wallpaper_id })));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Release the idempotency key so Razorpay's retry can process the event.
    await supabase.from('webhook_events').delete().eq('provider', 'razorpay').eq('event_id', eventId);
    console.error('[webhook] processing failed', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
