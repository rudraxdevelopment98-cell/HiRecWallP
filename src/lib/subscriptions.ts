import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { getProvider } from '@/lib/payments';
import { supportsSubscriptions, type WebhookVerificationResult } from '@/lib/payments/provider';
import type { PlanOffer } from '@/lib/membership';

/** Open-ended monthly plans renew up to this many months (Razorpay needs a count). */
export const OPEN_ENDED_MONTHS = 120;

const providerFor = (currency: string) => (currency === 'INR' ? 'razorpay' : 'razorpay_intl');

/**
 * Start autopay for a plan: make sure a monthly provider plan exists for this
 * price, create the subscription and record it. Nothing is granted here; each
 * monthly charge grants one month via the verified webhook.
 */
export async function startAutopay(userId: string, offer: PlanOffer, billingCountry: string | null) {
  const price = offer.autopay;
  if (!price) throw new Error('This plan has no monthly autopay price here.');
  const provider = getProvider(providerFor(price.currency));
  if (!supportsSubscriptions(provider)) throw new Error('Autopay is not available.');
  const supabase = createServiceClient();

  const planId = await provider.ensureMonthlyPlan({
    amountMinor: price.amount_minor,
    currency: price.currency,
    name: `HirecWallp ${offer.plan.name}`,
    existingPlanId: price.provider_plan_id,
  });
  if (planId !== price.provider_plan_id) {
    await supabase.from('plan_prices').update({ provider_plan_id: planId }).eq('id', price.id);
  }

  const totalCount = offer.plan.kind === 'contract' ? offer.plan.term_months : OPEN_ENDED_MONTHS;
  const { data: row, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_id: offer.plan.id,
      plan_price_id: price.id,
      status: 'created',
      currency: price.currency,
      amount_minor: price.amount_minor,
      total_count: totalCount,
    })
    .select('id')
    .single();
  if (error || !row) throw error ?? new Error('subscription insert failed');

  const created = await provider.createSubscription({
    planId,
    totalCount,
    notes: { subscriptionRowId: row.id, userId, planId: offer.plan.id, billingCountry: billingCountry ?? '' },
  });
  await supabase.from('subscriptions').update({ provider_subscription_id: created.providerSubscriptionId }).eq('id', row.id);
  return { subscriptionId: row.id, checkout: created.checkout, amountMinor: price.amount_minor, currency: price.currency, totalCount };
}

const STATUS_BY_EVENT: Record<string, string> = {
  'subscription.authenticated': 'authenticated',
  'subscription.activated': 'active',
  'subscription.charged': 'active',
  'subscription.resumed': 'active',
  'subscription.pending': 'pending',
  'subscription.halted': 'halted',
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'completed',
  'subscription.expired': 'expired',
};

/**
 * Handle a verified subscription.* webhook. `subscription.charged` creates a
 * paid order (receipt + invoice number) and grants one 30-day pass, idempotent
 * per payment. An INR subscription paid with a foreign card is refunded and
 * cancelled (India pricing is for Indian cards).
 */
export async function handleSubscriptionEvent(result: WebhookVerificationResult): Promise<Record<string, unknown>> {
  const sub = result.subscription;
  if (!sub) return { ignored: true };
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_id, currency, amount_minor, status')
    .eq('provider_subscription_id', sub.providerSubscriptionId)
    .maybeSingle();
  if (!row) return { unknownSubscription: true };

  const status = STATUS_BY_EVENT[result.eventType ?? ''] ?? sub.status ?? row.status;
  await supabase
    .from('subscriptions')
    .update({
      status,
      paid_count: sub.paidCount ?? undefined,
      current_end: sub.currentEnd ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (result.eventType !== 'subscription.charged' || !result.paymentId) return { status };

  const provider = getProvider(providerFor(row.currency as string));
  if (row.currency === 'INR' && result.international) {
    try {
      await provider.refundPayment(result.paymentId, 'international card on INR pricing');
      if (supportsSubscriptions(provider)) await provider.cancelSubscription(sub.providerSubscriptionId, false);
    } catch (err) {
      console.error('[subscription] refund/cancel failed', row.id, err);
    }
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', row.id);
    return { refunded: true };
  }

  // One order per charge (idempotent on the payment id).
  const providerOrderId = `subpay_${result.paymentId}`;
  const { data: existing } = await supabase.from('orders').select('id, status').eq('provider_order_id', providerOrderId).maybeSingle();
  let orderId = existing?.id as string | undefined;
  if (!orderId) {
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: row.user_id,
        provider: providerFor(row.currency as string),
        provider_order_id: providerOrderId,
        provider_payment_id: result.paymentId,
        status: 'paid',
        paid_at: new Date().toISOString(),
        currency: result.currency ?? row.currency,
        amount_minor: result.amountMinor ?? row.amount_minor,
        subscription_id: row.id,
      })
      .select('id')
      .single();
    if (error || !order) throw error ?? new Error('order insert failed');
    orderId = order.id as string;
    await supabase.from('order_items').insert({ order_id: orderId, membership_plan_id: row.plan_id });
    await supabase.rpc('assign_invoice', { p_order: orderId });
  }

  const { error: gErr } = await supabase.rpc('grant_membership', {
    p_user: row.user_id,
    p_plan: row.plan_id,
    p_order: orderId,
    p_days: 30,
    p_subscription: row.id,
  });
  if (gErr) throw gErr;
  return { granted: true, orderId };
}

/**
 * Customer cancels autopay (one click, as Indian dark-pattern rules require).
 * The month already paid keeps running; no further charges.
 */
export async function cancelAutopay(userId: string, subscriptionId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('subscriptions')
    .select('id, user_id, currency, provider_subscription_id, status')
    .eq('id', subscriptionId)
    .maybeSingle();
  if (!row || row.user_id !== userId) throw new Error('Subscription not found');
  if (['cancelled', 'completed', 'expired'].includes(row.status as string)) return;
  if (row.provider_subscription_id) {
    const provider = getProvider(providerFor(row.currency as string));
    if (supportsSubscriptions(provider)) {
      // Not yet authorised → cancel immediately; otherwise at the end of the paid month.
      await provider.cancelSubscription(row.provider_subscription_id as string, row.status !== 'created');
    }
  }
  await supabase
    .from('subscriptions')
    .update(row.status === 'created' ? { status: 'cancelled' } : { cancel_at_cycle_end: true, updated_at: new Date().toISOString() })
    .eq('id', row.id);
}
