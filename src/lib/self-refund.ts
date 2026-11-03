import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { refundOrder } from '@/lib/refunds';
import { selfRefundDecision, type RefundDecision, type RefundFacts } from '@/lib/refund-rules';
import { createTicket } from '@/lib/support';

const SELF_REFUND_SUBJECT = 'Refund (self-serve)';
const SELF_REFUND_LIMIT = 2;
const SELF_REFUND_WINDOW_DAYS = 90;

export async function refundFactsFor(orderId: string, userId: string): Promise<RefundFacts | null> {
  const { data, error } = await createServiceClient().rpc('refund_facts', { p_order: orderId });
  if (error || !data) return null;
  const f = data as RefundFacts & { user_id: string };
  return f.user_id === userId ? f : null;
}

/** What the customer would get if they asked now (null = not their order). */
export async function selfRefundOption(orderId: string, userId: string): Promise<RefundDecision | null> {
  const facts = await refundFactsFor(orderId, userId);
  return facts ? selfRefundDecision(facts) : null;
}

export type SelfRefundResult =
  | { status: 'refunded'; ticketId: string; summary: string }
  | { status: 'not_eligible'; reason: string; reviewable: boolean }
  | { status: 'not_found' };

/**
 * Instant refund for orders the policy covers without judgement. Re-checks the
 * rules right before refunding; refundOrder() claims paid → refunded atomically,
 * so a double click can't refund twice. The outcome is recorded as a resolved
 * support ticket so the customer and the admin both have the paper trail.
 */
export async function selfRefund(orderId: string, userId: string, note: string): Promise<SelfRefundResult> {
  const facts = await refundFactsFor(orderId, userId);
  if (!facts) return { status: 'not_found' };
  const d = selfRefundDecision(facts);
  if (!d.eligible) return { status: 'not_eligible', reason: d.reason, reviewable: d.reviewable };

  // Buy-and-refund loops cost payment fees: after a few instant refunds, a person reviews.
  const since = new Date(Date.now() - SELF_REFUND_WINDOW_DAYS * 86_400_000).toISOString();
  const { count } = await createServiceClient()
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('subject', SELF_REFUND_SUBJECT)
    .gte('created_at', since);
  if ((count ?? 0) >= SELF_REFUND_LIMIT) {
    return { status: 'not_eligible', reason: 'You’ve had several instant refunds recently, so this one needs a quick review by our team.', reviewable: true };
  }

  await refundOrder(orderId, 'Customer self-serve refund', true);
  const systemNote = `Refunded automatically under the Refund Policy. ${d.summary} The money goes back to your original payment method; banks usually show it within 5–7 business days.`;
  const ticket = await createTicket({
    userId,
    category: 'refund',
    subject: SELF_REFUND_SUBJECT,
    body: note || 'Refund requested from Account → Orders.',
    orderId,
    resolved: { resolution: 'Refunded', systemNote },
  });
  return { status: 'refunded', ticketId: ticket.id, summary: d.summary };
}
