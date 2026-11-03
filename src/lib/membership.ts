import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { pickPricePoints, type PriceContext } from '@/lib/geo';

export type PlanKind = 'monthly' | 'contract' | 'category' | 'business';
export type Billing = 'prepaid' | 'autopay';

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  monthly: 'Monthly',
  contract: 'Long-term',
  category: 'Category passes',
  business: 'Business',
};

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  kind: PlanKind;
  term_months: number;
  duration_days: number;
  /** Wallpapers per 30-day period. */
  download_limit: number;
  includes_commercial: boolean;
  category_id: string | null;
  badge: 'recommended' | 'best_value' | null;
  perks: string[];
  active: boolean;
  sort_order: number;
  categories?: { name: string; slug: string } | null;
}

export interface PlanPrice {
  id: string;
  plan_id: string;
  billing: Billing;
  region_code: string;
  country_codes: string[];
  currency: string;
  amount_minor: number;
  provider_plan_id: string | null;
  active: boolean;
}

export interface PlanOffer {
  plan: MembershipPlan;
  /** Whole term, paid once. */
  prepaid: PlanPrice | null;
  /** Charged every month, `plan.term_months` times (open-ended for monthly plans). */
  autopay: PlanPrice | null;
}

const PLAN_SELECT = '*, categories(name, slug)';

function toOffers(plans: MembershipPlan[], prices: PlanPrice[], ctx: PriceContext): PlanOffer[] {
  const picked = pickPricePoints(prices, ctx, (p) => `${p.plan_id}:${p.billing}`);
  const by = new Map(picked.map((p) => [`${p.plan_id}:${p.billing}`, p]));
  return plans
    .map((plan) => ({ plan, prepaid: by.get(`${plan.id}:prepaid`) ?? null, autopay: by.get(`${plan.id}:autopay`) ?? null }))
    .filter((o) => o.prepaid || o.autopay);
}

/** Active plans with the prices that apply to this visitor (public). */
export async function listPlanOffers(ctx: PriceContext): Promise<PlanOffer[]> {
  try {
    const supabase = await createClient();
    const [{ data: plans }, { data: prices }] = await Promise.all([
      supabase.from('membership_plans').select(PLAN_SELECT).eq('active', true).order('sort_order', { ascending: true }),
      supabase.from('plan_prices').select('*').eq('active', true).eq('region_code', ctx.region),
    ]);
    return toOffers((plans ?? []) as MembershipPlan[], (prices ?? []) as PlanPrice[], ctx);
  } catch {
    return [];
  }
}

/** One plan's offer for checkout (service role; re-validated server-side). */
export async function getPlanOffer(planId: string, ctx: PriceContext): Promise<PlanOffer | null> {
  const supabase = createServiceClient();
  const [{ data: plan }, { data: prices }] = await Promise.all([
    supabase.from('membership_plans').select(PLAN_SELECT).eq('id', planId).eq('active', true).maybeSingle(),
    supabase.from('plan_prices').select('*').eq('plan_id', planId).eq('active', true).eq('region_code', ctx.region),
  ]);
  if (!plan) return null;
  return toOffers([plan as MembershipPlan], (prices ?? []) as PlanPrice[], ctx)[0] ?? null;
}

export interface MyPass {
  id: string;
  plan_name: string | null;
  kind: PlanKind | null;
  category_id: string | null;
  category_name: string | null;
  includes_commercial: boolean;
  starts_at: string;
  ends_at: string;
  /** Allowance per 30-day period. */
  allowance: number;
  used_this_period: number;
  /** When the allowance next refreshes (or the pass ends, whichever is first). */
  resets_at: string;
  autopay: { status: string; cancel_at_cycle_end: boolean } | null;
}

/** Period maths mirroring member_unlock(): periods of `days` from `start`. */
export function currentPeriod(start: Date, days: number, now = new Date()): { start: Date; end: Date } {
  const len = days * 86_400_000;
  const n = Math.max(0, Math.floor((now.getTime() - start.getTime()) / len));
  const s = new Date(start.getTime() + n * len);
  return { start: s, end: new Date(s.getTime() + len) };
}

/** The signed-in user's running passes (RLS: own rows), soonest-ending first. */
export async function getMyPasses(): Promise<MyPass[]> {
  try {
    const now = new Date();
    const { data } = await (await createClient())
      .from('memberships')
      .select(
        'id, starts_at, ends_at, download_limit, period_days, period_start, period_used, includes_commercial, category_id, membership_plans(name, kind), categories(name), subscriptions(status, cancel_at_cycle_end)',
      )
      .eq('status', 'active')
      .gt('ends_at', now.toISOString())
      .order('ends_at', { ascending: true });
    type Row = {
      id: string; starts_at: string; ends_at: string; download_limit: number; period_days: number;
      period_start: string | null; period_used: number; includes_commercial: boolean; category_id: string | null;
      membership_plans: { name: string; kind: PlanKind } | null; categories: { name: string } | null;
      subscriptions: { status: string; cancel_at_cycle_end: boolean } | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => {
      const started = new Date(r.starts_at) <= now;
      const p = currentPeriod(new Date(r.starts_at), r.period_days, now);
      const samePeriod = r.period_start != null && new Date(r.period_start).getTime() === p.start.getTime();
      const ends = new Date(r.ends_at);
      return {
        id: r.id,
        plan_name: r.membership_plans?.name ?? null,
        kind: r.membership_plans?.kind ?? null,
        category_id: r.category_id,
        category_name: r.categories?.name ?? null,
        includes_commercial: r.includes_commercial,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        allowance: r.download_limit,
        used_this_period: started && samePeriod ? r.period_used : 0,
        resets_at: (p.end < ends ? p.end : ends).toISOString(),
        autopay: r.subscriptions ? { status: r.subscriptions.status, cancel_at_cycle_end: r.subscriptions.cancel_at_cycle_end } : null,
      };
    });
  } catch {
    return [];
  }
}

export interface MyAutopay {
  id: string;
  status: string;
  plan_name: string | null;
  currency: string;
  amount_minor: number;
  total_count: number;
  paid_count: number;
  current_end: string | null;
  cancel_at_cycle_end: boolean;
}

/** The signed-in user's live autopay subscriptions (RLS: own rows). */
export async function getMyAutopays(): Promise<MyAutopay[]> {
  try {
    const { data } = await (await createClient())
      .from('subscriptions')
      .select('id, status, currency, amount_minor, total_count, paid_count, current_end, cancel_at_cycle_end, membership_plans(name)')
      .in('status', ['authenticated', 'active', 'pending', 'halted'])
      .order('created_at', { ascending: false });
    type Row = Omit<MyAutopay, 'plan_name'> & { membership_plans: { name: string } | null };
    return ((data ?? []) as unknown as Row[]).map(({ membership_plans, ...r }) => ({ ...r, plan_name: membership_plans?.name ?? null }));
  } catch {
    return [];
  }
}

/** Passes that could add this wallpaper now (started, covering its category, allowance left). */
export function passesFor(passes: MyPass[], wallpaperCategoryId: string | null, parentCategoryId: string | null = null): MyPass[] {
  const now = Date.now();
  return passes.filter(
    (p) =>
      new Date(p.starts_at).getTime() <= now &&
      p.used_this_period < p.allowance &&
      (p.category_id == null || p.category_id === wallpaperCategoryId || p.category_id === parentCategoryId),
  );
}

/** Use the user's pass to add a wallpaper to their library. */
export async function memberUnlock(userId: string, wallpaperId: string, maxDownloads: number): Promise<string | null> {
  const { data, error } = await createServiceClient().rpc('member_unlock', {
    p_user: userId,
    p_wallpaper: wallpaperId,
    p_max_downloads: maxDownloads,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}
