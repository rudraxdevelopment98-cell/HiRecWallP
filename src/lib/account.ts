import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { cancelAutopay } from '@/lib/subscriptions';
import { mail, safeSend, siteUrl } from '@/lib/mail-template';
import { publicEnv } from '@/lib/env';

export interface AccountSummary {
  role: 'buyer' | 'creator' | 'admin';
  paid_credits: number;
  bonus_credits: number;
  library: number;
  active_passes: number;
  autopay: number;
  orders: number;
  pending_payouts: number;
}

export async function getAccountSummary(userId: string): Promise<AccountSummary | null> {
  const { data, error } = await createServiceClient().rpc('account_summary', { p_user: userId });
  return error || !data ? null : (data as AccountSummary);
}

/** Why closing isn't possible right now (null = it is). */
export function closeBlocker(s: AccountSummary): string | null {
  if (s.role === 'admin') return 'Admin accounts can’t be closed here. Remove the admin role first.';
  if (s.pending_payouts > 0) return 'You have a creator payout in progress. Close your account after it has been paid.';
  return null;
}

export type CloseResult = { status: 'closed' } | { status: 'blocked'; reason: string } | { status: 'error' };

/**
 * Close an account (DPDP right to erasure). Order matters: stop future charges,
 * erase personal data in the database, then retire the login (new placeholder
 * email + ban, so the same email can sign up fresh later). Orders and invoices
 * stay for 8 years under tax law, without a name or email attached.
 */
export async function closeAccount(userId: string, email: string | null): Promise<CloseResult> {
  const s = createServiceClient();
  const summary = await getAccountSummary(userId);
  if (!summary) return { status: 'error' };
  const blocked = closeBlocker(summary);
  if (blocked) return { status: 'blocked', reason: blocked };

  const { data: subs } = await s
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['created', 'authenticated', 'active', 'pending'])
    .eq('cancel_at_cycle_end', false);
  for (const sub of subs ?? []) await cancelAutopay(userId, sub.id as string);

  const { error } = await s.rpc('close_account', { p_user: userId });
  if (error) {
    if (/admin_account|payout_pending/.test(error.message)) return { status: 'blocked', reason: closeBlocker({ ...summary, role: /admin/.test(error.message) ? 'admin' : summary.role, pending_payouts: 1 }) ?? 'Not possible right now.' };
    console.error('[account] close failed', error);
    return { status: 'error' };
  }

  const { error: authErr } = await s.auth.admin.updateUserById(userId, {
    email: `deleted-${userId}@deleted.invalid`,
    email_confirm: true,
    ban_duration: '876000h',
    user_metadata: { full_name: null, name: null, avatar_url: null, picture: null },
  });
  if (authErr) {
    console.error('[account] auth retire failed', authErr);
    return { status: 'error' };
  }

  await safeSend(
    email,
    `Your ${publicEnv.NEXT_PUBLIC_BRAND_NAME} account is closed`,
    mail('Your account is closed', [
      'As you asked, we closed your account and removed your personal details. Remaining credits, passes and your library have ended.',
      'We keep order and invoice records for 8 years because tax law requires it — without your name or email.',
      `If you didn’t do this, reply via ${siteUrl()}/contact straight away.`,
    ]),
  );
  return { status: 'closed' };
}

/** Everything we hold about the person, as one JSON document (DPDP right to access). */
export async function buildExport(userId: string): Promise<Record<string, unknown>> {
  const s = createServiceClient();
  const q = <T,>(p: PromiseLike<{ data: T | null }>) => Promise.resolve(p).then((r) => r.data ?? []);
  const [profile, orders, ledger, library, downloads, passes, subs, favourites, tickets, giftsBought, giftsRedeemed, referrals, consents] = await Promise.all([
    s.from('profiles').select('id, email, display_name, country_code, gstin, role, price_country, referral_code, created_at').eq('id', userId).maybeSingle().then((r) => r.data),
    q(s.from('orders').select('id, status, provider, currency, amount_minor, billing_country, invoice_no, buyer_gstin, created_at, paid_at, order_items(credit_pack_id, membership_plan_id, wallpaper_id, licence)').eq('user_id', userId).order('created_at')),
    q(s.from('credit_ledger').select('delta, reason, bucket, ref_id, expires_at, created_at').eq('user_id', userId).order('created_at')),
    q(s.from('entitlements').select('wallpaper_id, licence, source, max_downloads, downloads_used, created_at, wallpapers(title, slug)').eq('user_id', userId)),
    q(s.from('downloads').select('wallpaper_id, created_at').eq('user_id', userId).order('created_at')),
    q(s.from('memberships').select('plan_id, starts_at, ends_at, download_limit, status, membership_plans(name)').eq('user_id', userId)),
    q(s.from('subscriptions').select('status, currency, amount_minor, cancel_at_cycle_end, created_at').eq('user_id', userId)),
    q(s.from('favourites').select('wallpaper_id, created_at').eq('user_id', userId)),
    q(s.from('support_tickets').select('number, category, subject, status, created_at, resolved_at, support_messages(author_role, body, internal, created_at)').eq('user_id', userId)),
    q(s.from('gift_codes').select('recipient_email, credits, bonus_credits, status, created_at, redeemed_at').eq('purchaser_id', userId)),
    q(s.from('gift_codes').select('credits, bonus_credits, redeemed_at').eq('redeemed_by', userId)),
    q(s.from('referral_rewards').select('status, created_at').eq('referrer_id', userId)),
    q(s.from('policy_acceptances').select('policy, version, context, accepted_at').eq('user_id', userId)),
  ]);
  type Ticket = { support_messages?: { internal: boolean }[] };
  return {
    exported_at: new Date().toISOString(),
    note: 'Your data held by HirecWallp. Hashed IP addresses are one-way and cannot identify you, so they are not included.',
    profile,
    orders,
    credit_history: ledger,
    library,
    downloads,
    memberships: passes,
    autopay: subs,
    favourites,
    support_requests: (tickets as Ticket[]).map((t) => ({ ...t, support_messages: (t.support_messages ?? []).filter((m) => !m.internal) })),
    gifts_bought: giftsBought,
    gifts_redeemed: giftsRedeemed,
    referrals,
    consents,
  };
}
