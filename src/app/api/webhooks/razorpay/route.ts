import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getProvider } from '@/lib/payments';

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

  // Acknowledge non-payment events without side effects.
  if (!result.paid || !result.providerOrderId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createServiceClient();

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

  // Load the order this event refers to.
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, status')
    .eq('provider_order_id', result.providerOrderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ ok: true, unknownOrder: true });
  if (order.status === 'paid') return NextResponse.json({ ok: true, alreadyPaid: true });

  await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id);

  const { data: items } = await supabase
    .from('order_items')
    .select('wallpaper_id, set_id, credit_pack_id')
    .eq('order_id', order.id);

  for (const item of items ?? []) {
    if (item.wallpaper_id) {
      await supabase.rpc('grant_entitlement', {
        p_user: order.user_id,
        p_wallpaper: item.wallpaper_id,
        p_order: order.id,
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
        });
      }
    } else if (item.credit_pack_id) {
      const { data: pack } = await supabase
        .from('credit_packs')
        .select('credits')
        .eq('id', item.credit_pack_id)
        .maybeSingle();
      if (pack) {
        await supabase.rpc('add_credits', {
          p_user: order.user_id,
          p_credits: pack.credits,
          p_order: order.id,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
