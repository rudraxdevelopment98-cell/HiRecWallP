import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { getProvider } from '@/lib/payments';
import type { ProviderId } from '@/lib/payments/provider';

export interface RefundResult {
  refundedAtProvider: boolean;
  entitlementsRemoved: number;
  creditsReversed: number;
  passesRevoked: number;
}

/**
 * Refund a paid order and take back what it unlocked: wallpaper access,
 * purchased credits (a negative ledger entry, so a balance can go below zero
 * if they were already spent) and membership passes.
 * `viaProvider: false` = the money was already refunded in the Razorpay
 * dashboard; only access is revoked here.
 */
export async function refundOrder(orderId: string, reason: string, viaProvider: boolean): Promise<RefundResult> {
  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, status, provider, provider_payment_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) throw new Error('Order not found');
  if (order.status !== 'paid') throw new Error(`Only paid orders can be refunded (this one is "${order.status}")`);

  let refundedAtProvider = false;
  if (viaProvider) {
    if (!order.provider_payment_id) {
      throw new Error('No payment id stored for this order — refund it in the Razorpay dashboard, then use "access only".');
    }
    await getProvider(order.provider as ProviderId).refundPayment(order.provider_payment_id as string, reason);
    refundedAtProvider = true;
  }

  // Claim the status change first so a double click can't reverse twice.
  const { data: claimed } = await supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', orderId)
    .eq('status', 'paid')
    .select('id');
  if (!claimed?.length) throw new Error('Order was already refunded');

  const { data: removed } = await supabase.from('entitlements').delete().eq('order_id', orderId).select('id');

  // Paid credits are reversed in full; bonus credits lose whatever is left.
  const { data: reversed, error: revErr } = await supabase.rpc('reverse_order_credits', { p_order: orderId, p_reason: reason });
  if (revErr) throw revErr;
  const credits = Number(reversed ?? 0);

  // Gifts: an unredeemed code is cancelled (a redeemed one had its credits
  // reversed above); affiliate commission on this order is voided.
  await supabase.from('gift_codes').update({ status: 'void' }).eq('order_id', orderId).eq('status', 'pending');
  await supabase.from('affiliate_commissions').update({ status: 'void' }).eq('order_id', orderId).neq('status', 'paid');

  const { data: revoked } = await supabase
    .from('memberships')
    .update({ status: 'revoked', note: `Refunded: ${reason}` })
    .eq('order_id', orderId)
    .select('id');

  return {
    refundedAtProvider,
    entitlementsRemoved: removed?.length ?? 0,
    creditsReversed: credits,
    passesRevoked: revoked?.length ?? 0,
  };
}
