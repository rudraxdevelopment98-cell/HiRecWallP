/**
 * Self-serve refund rules — the automatable part of the Refund & Cancellation
 * Policy (/refunds). Anything that doesn't pass here still gets a fair review
 * through a support ticket; this only decides what can be refunded instantly.
 * Keep in sync with src/app/refunds/page.tsx.
 */

export type RefundKind = 'credit_pack' | 'gift' | 'membership' | 'autopay' | 'other';

export interface RefundFacts {
  status: string;
  paid_at: string;
  has_payment_id: boolean;
  kind: RefundKind;
  /** Paid credits this order added. */
  pack_credits: number;
  /** Credit spends on the account since this order was paid. */
  spends_since: number;
  /** Paid credit balance now. */
  paid_balance: number;
  gift_status: 'pending' | 'redeemed' | 'void' | null;
  /** Wallpapers added with the pass bought by this order (null = no pass row). */
  membership_used: number | null;
  membership_status: 'active' | 'revoked' | null;
}

export const SELF_REFUND_DAYS: Record<'credit_pack' | 'gift' | 'membership', number> = {
  credit_pack: 14,
  gift: 14,
  membership: 7,
};

export type RefundDecision =
  | { eligible: true; kind: RefundKind; summary: string }
  | { eligible: false; kind: RefundKind; reason: string; /** Worth a manual review ticket. */ reviewable: boolean };

const DAY = 86_400_000;

export function selfRefundDecision(f: RefundFacts, now: Date = new Date()): RefundDecision {
  const no = (reason: string, reviewable = true): RefundDecision => ({ eligible: false, kind: f.kind, reason, reviewable });
  if (f.status === 'refunded') return no('This order has already been refunded.', false);
  if (f.status !== 'paid') return no('Only completed payments can be refunded.', false);
  if (!f.has_payment_id) return no('This payment needs a manual refund — ask us and we’ll handle it.');

  const ageDays = (now.getTime() - new Date(f.paid_at).getTime()) / DAY;

  switch (f.kind) {
    case 'credit_pack': {
      if (ageDays > SELF_REFUND_DAYS.credit_pack) return no(`Credit packs can be refunded within ${SELF_REFUND_DAYS.credit_pack} days of purchase.`);
      // Credits are pooled, so "unused" means nothing was spent since buying.
      if (f.spends_since > 0) return no('Credits have been used since you bought this pack, so it can’t be refunded automatically.');
      if (f.paid_balance < f.pack_credits) return no('Your balance is lower than this pack, so it needs a manual review.');
      return { eligible: true, kind: f.kind, summary: `${f.pack_credits} credits (and any bonus credits from this pack) will be removed.` };
    }
    case 'gift': {
      if (ageDays > SELF_REFUND_DAYS.gift) return no(`Gifts can be refunded within ${SELF_REFUND_DAYS.gift} days of purchase.`);
      if (f.gift_status !== 'pending') return no('This gift has already been redeemed, so it can’t be refunded.', false);
      return { eligible: true, kind: f.kind, summary: 'The gift code will stop working.' };
    }
    case 'membership': {
      if (ageDays > SELF_REFUND_DAYS.membership) return no(`Pay-once memberships can be refunded within ${SELF_REFUND_DAYS.membership} days of purchase.`);
      if (f.membership_status !== 'active' || f.membership_used == null) return no('This pass needs a manual review.');
      if (f.membership_used > 0) return no('Wallpapers have been added with this pass, so it can’t be refunded.', false);
      return { eligible: true, kind: f.kind, summary: 'Your pass will end immediately.' };
    }
    case 'autopay':
      return no('Autopay charges are refunded on request within 48 hours if the month is unused — open a request and we’ll check it.');
    default:
      return no('This order needs a manual review.');
  }
}
