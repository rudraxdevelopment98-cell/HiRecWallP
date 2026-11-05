import 'server-only';

import { cookies, headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { hashIp } from '@/lib/request';
import { getSettings } from '@/lib/settings';
import { recordAcceptance } from '@/lib/consent';
import { sendWelcomeEmail } from '@/lib/account-emails';

export const REF_COOKIE = 'ref';
export const REF_CODE = /^[A-Z0-9]{6,12}$/;

function ipFrom(h: Headers): string | null {
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? h.get('cf-connecting-ip');
  return ip || null;
}

/**
 * Give a newly signed-in account its welcome bonus (once), attaching the
 * referral code from the `ref` cookie if there is one. Safe to call on every
 * sign-in: the database makes it idempotent and enforces the anti-abuse rules
 * (2 per network per 30 days, no self-referral, new accounts only).
 */
export async function claimWelcomeBonus(userId: string): Promise<{ status: string; credits?: number; referred?: boolean }> {
  // Signing in = accepting the current Terms and Privacy Policy (shown on the sign-in page).
  await recordAcceptance(userId, ['terms', 'privacy'], 'signup');
  try {
    const settings = await getSettings();
    const g = settings.growth;
    const [c, h] = await Promise.all([cookies(), headers()]);
    const ref = c.get(REF_COOKIE)?.value?.toUpperCase() ?? null;
    const ip = ipFrom(h);
    const { data, error } = await createServiceClient().rpc('claim_welcome_bonus', {
      p_user: userId,
      p_ref_code: g.referral_enabled && ref && REF_CODE.test(ref) ? ref : null,
      p_ip_hash: ip ? hashIp(ip) : null,
      p_bonus: g.welcome_credits,
      p_ref_bonus: g.referral_enabled ? g.referee_bonus : 0,
      p_days: g.welcome_days,
    });
    if (error) return { status: 'error' };
    const r = data as { status: string; credits?: number; referred?: boolean };
    if (r.status === 'granted' || r.status === 'limited') await sendWelcomeEmail(userId, r.credits ?? 0).catch(() => undefined);
    return r;
  } catch {
    return { status: 'error' };
  }
}

export interface MyReferral {
  code: string;
  invited: number;
  rewarded: number;
  pending: number;
  creditsEarned: number;
}

/** The signed-in user's referral code and stats. */
export async function getMyReferral(userId: string): Promise<MyReferral | null> {
  try {
    const service = createServiceClient();
    const { data: code } = await service.rpc('ensure_referral_code', { p_user: userId });
    const { data: rows } = await (await createClient())
      .from('referral_rewards')
      .select('status, credits')
      .eq('referrer_id', userId);
    const list = (rows ?? []) as { status: string; credits: number | null }[];
    return {
      code: code as string,
      invited: list.length,
      rewarded: list.filter((r) => r.status === 'rewarded').length,
      pending: list.filter((r) => r.status === 'pending').length,
      creditsEarned: list.reduce((n, r) => n + (r.status === 'rewarded' ? r.credits ?? 0 : 0), 0),
    };
  } catch {
    return null;
  }
}

export const AFF_COOKIE = 'aff';

/**
 * The creator who should earn the affiliate commission on this buyer's order:
 * the `aff` cookie's code, if it belongs to a creator (not rejected) other
 * than the buyer. Null when affiliates are off or nothing matches.
 */
export async function resolveAffiliate(buyerId: string): Promise<string | null> {
  try {
    if (!(await getSettings()).growth.affiliate_enabled) return null;
    const code = (await cookies()).get(AFF_COOKIE)?.value?.toUpperCase();
    if (!code || !REF_CODE.test(code)) return null;
    const supabase = createServiceClient();
    const { data: p } = await supabase.from('profiles').select('id').eq('referral_code', code).maybeSingle();
    if (!p || p.id === buyerId) return null;
    const { data: c } = await supabase.from('creators').select('user_id, kyc_status').eq('user_id', p.id).maybeSingle();
    return c && c.kyc_status !== 'rejected' ? (p.id as string) : null;
  } catch {
    return null;
  }
}
