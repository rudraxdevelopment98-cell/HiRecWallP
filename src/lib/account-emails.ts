import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { escapeHtml } from '@/lib/gift-rules';
import { formatMoneyMinor } from '@/lib/format';
import { mail, safeSend, siteUrl } from '@/lib/mail-template';

const brand = () => publicEnv.NEXT_PUBLIC_BRAND_NAME;
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

interface ReceiptRow {
  id: string;
  user_id: string;
  amount_minor: number;
  currency: string;
  invoice_no: string | null;
  paid_at: string | null;
  created_at: string;
  gift_email: string | null;
  profiles: { email: string | null } | null;
  order_items: { credit_packs: { credits: number; bonus_credits: number | null } | null; membership_plans: { name: string } | null }[];
}

/**
 * Payment receipt, sent once per paid order (claimed via orders.receipt_sent_at,
 * so webhook retries don't send twice). The printable receipt stays in the account.
 */
export async function sendReceiptEmail(orderId: string): Promise<void> {
  const s = createServiceClient();
  const { data: claimed } = await s
    .from('orders')
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'paid')
    .is('receipt_sent_at', null)
    .select('id');
  if (!claimed?.length) return;
  const { data: o } = await s
    .from('orders')
    .select('id, user_id, amount_minor, currency, invoice_no, paid_at, created_at, gift_email, profiles!orders_user_id_fkey(email), order_items(credit_packs(credits, bonus_credits), membership_plans(name))')
    .eq('id', orderId)
    .maybeSingle<ReceiptRow>();
  if (!o?.profiles?.email) return;
  const lines = o.order_items.map((i) =>
    i.credit_packs
      ? `${i.credit_packs.credits} credits${i.credit_packs.bonus_credits ? ` + ${i.credit_packs.bonus_credits} bonus` : ''}${o.gift_email ? ` — gift for ${escapeHtml(o.gift_email)}` : ''}`
      : i.membership_plans
        ? `Membership: ${escapeHtml(i.membership_plans.name)}`
        : 'Purchase',
  );
  const sent = await safeSend(
    o.profiles.email,
    `Your ${brand()} receipt${o.invoice_no ? ` ${o.invoice_no}` : ''}`,
    mail(
      'Thanks — payment received',
      [
        `<strong>${formatMoneyMinor(o.amount_minor, o.currency)}</strong> paid on ${day(o.paid_at ?? o.created_at)}${o.invoice_no ? ` · ${escapeHtml(o.invoice_no)}` : ''}.`,
        lines.join('<br>'),
        o.gift_email ? 'Your friend gets an email with their gift code.' : 'Your credits or pass are ready in your account.',
        `Changed your mind? Unused packs and passes can be refunded from Account → Orders (see our <a href="${siteUrl()}/refunds">Refund Policy</a>).`,
      ],
      { href: `${siteUrl()}/account/orders/${o.id}`, label: 'View receipt' },
    ),
  );
  // Nothing was sent (no email provider yet): release the claim so it can go out later.
  if (!sent) await s.from('orders').update({ receipt_sent_at: null }).eq('id', o.id);
}

/** One welcome email for new accounts (within 2 days of sign-up). */
export async function sendWelcomeEmail(userId: string, bonusCredits: number): Promise<void> {
  const s = createServiceClient();
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data } = await s
    .from('profiles')
    .update({ welcome_email_at: new Date().toISOString() })
    .eq('id', userId)
    .is('welcome_email_at', null)
    .is('deleted_at', null)
    .gte('created_at', since)
    .select('email')
    .maybeSingle();
  if (!data?.email) return;
  const sent = await safeSend(
    data.email as string,
    `Welcome to ${brand()}`,
    mail(
      `Welcome to ${brand()}`,
      [
        bonusCredits > 0
          ? `You have <strong>${bonusCredits} free credits</strong> — that’s ${bonusCredits} ultra-HD wallpapers in every size (bonus credits last 12 months).`
          : 'Your account is ready.',
        'Every wallpaper page shows how it looks on your own phone or computer before you choose. Need help? Account → Help & support.',
      ],
      { href: `${siteUrl()}/explore`, label: 'Explore wallpapers' },
    ),
  );
  if (!sent) await s.from('profiles').update({ welcome_email_at: null }).eq('id', userId);
}

interface DueLot {
  lot_id: string;
  user_id: string;
  email: string;
  remaining: number;
  expires_at: string;
}

/** Daily: remind people about bonus credits that expire within a week (one email per person). */
export async function runBonusExpiryReminders(days = 7): Promise<number> {
  const s = createServiceClient();
  const { data, error } = await s.rpc('bonus_expiry_due', { p_days: days });
  if (error || !data) return 0;
  const byUser = new Map<string, DueLot[]>();
  for (const l of data as DueLot[]) byUser.set(l.user_id, [...(byUser.get(l.user_id) ?? []), l]);
  let sent = 0;
  for (const lots of byUser.values()) {
    const total = lots.reduce((n, l) => n + l.remaining, 0);
    const first = lots.map((l) => l.expires_at).sort()[0]!;
    const ok = await safeSend(
      lots[0]!.email,
      `${total} bonus credit${total === 1 ? '' : 's'} expire ${day(first)}`,
      mail(
        'Your bonus credits expire soon',
        [
          `You have <strong>${total} bonus credit${total === 1 ? '' : 's'}</strong> expiring on ${day(first)}. Bonus credits are always used before the credits you paid for.`,
          'Credits you paid for never expire — this only affects bonus credits.',
        ],
        { href: `${siteUrl()}/explore`, label: 'Use them now' },
      ),
    );
    if (ok) {
      sent += 1;
      await s.from('credit_ledger').update({ reminded_at: new Date().toISOString() }).in('id', lots.map((l) => l.lot_id));
    }
  }
  return sent;
}
