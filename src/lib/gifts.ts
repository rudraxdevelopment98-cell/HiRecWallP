import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/email';
import { getPriceContext } from '@/lib/catalogue';
import { publicEnv } from '@/lib/env';
import { canRedeemIn, escapeHtml, formatGiftCode, GIFT_CODE, normaliseGiftCode } from '@/lib/gift-rules';

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/** Email the recipient their gift link (no-op without RESEND_API_KEY; the buyer can also share the code). */
export async function sendGiftEmail(orderId: string, code: string): Promise<void> {
  const { data: g } = await createServiceClient()
    .from('gift_codes')
    .select('recipient_email, from_name, message, credits, bonus_credits')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!g?.recipient_email) return;
  const brand = publicEnv.NEXT_PUBLIC_BRAND_NAME;
  const total = Number(g.credits) + Number(g.bonus_credits ?? 0);
  const from = escapeHtml((g.from_name as string | null) ?? 'A friend');
  const link = `${site()}/gift/${code}`;
  await sendEmail({
    to: g.recipient_email as string,
    subject: `${(g.from_name as string | null) ?? 'A friend'} sent you ${total} wallpaper credits`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;line-height:1.5">
      <h2 style="margin:0 0 8px">You've got a gift on ${escapeHtml(brand)}</h2>
      <p><strong>${from}</strong> sent you <strong>${total} credits</strong> — that's ${total} ultra-HD wallpapers in every size.</p>
      ${g.message ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #c8650a;background:#f6f6f6">${escapeHtml(g.message as string)}</blockquote>` : ''}
      <p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Redeem your gift</a></p>
      <p style="color:#666;font-size:13px">Or enter code <strong>${formatGiftCode(code)}</strong> at ${escapeHtml(site())}/gift. Valid for 12 months.</p>
    </div>`,
  });
}

export type RedeemResult =
  | { status: 'redeemed'; credits: number }
  | { status: 'not_found' | 'used' | 'already_yours' | 'void' | 'expired' | 'wrong_region' | 'invalid' };

/** Redeem a gift for the signed-in user, enforcing the region rule. */
export async function redeemGift(userId: string, input: string): Promise<RedeemResult> {
  const code = normaliseGiftCode(input);
  if (!GIFT_CODE.test(code)) return { status: 'invalid' };
  const supabase = createServiceClient();
  const { data: g } = await supabase.from('gift_codes').select('region_code, status').eq('code', code).maybeSingle();
  if (!g) return { status: 'not_found' };
  if (g.status === 'pending' && !canRedeemIn(g.region_code as string, (await getPriceContext()).region)) {
    return { status: 'wrong_region' };
  }
  const { data, error } = await supabase.rpc('redeem_gift', { p_code: code, p_user: userId });
  if (error) throw error;
  return data as RedeemResult;
}

export const REDEEM_MESSAGE: Record<string, string> = {
  invalid: 'That doesn’t look like a gift code. Codes have 12 letters and numbers.',
  not_found: 'We couldn’t find that gift code. Check it and try again.',
  used: 'This gift has already been redeemed.',
  already_yours: 'You already redeemed this gift — the credits are in your account.',
  void: 'This gift was cancelled.',
  expired: 'This gift has expired.',
  wrong_region: 'This gift was bought for a different region and can’t be redeemed here. Please contact support.',
};
