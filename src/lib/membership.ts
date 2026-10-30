import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { REGION_CURRENCY, type RegionCode } from '@/lib/geo';

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  prices: Partial<Record<RegionCode, number>>;
  download_limit: number;
  includes_commercial: boolean;
  perks: string[];
  active: boolean;
  sort_order: number;
}

export interface ActiveMembership {
  id: string;
  ends_at: string;
  starts_at: string;
  download_limit: number;
  downloads_used: number;
  includes_commercial: boolean;
  plan_name: string | null;
}

/** Active plans with a price for `region` (public). */
export async function listPlansFor(region: RegionCode): Promise<(MembershipPlan & { amountMinor: number; currency: string })[]> {
  try {
    const { data } = await (await createClient())
      .from('membership_plans')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    return ((data ?? []) as MembershipPlan[])
      .filter((p) => typeof p.prices?.[region] === 'number')
      .map((p) => ({ ...p, amountMinor: p.prices[region]!, currency: REGION_CURRENCY[region] }));
  } catch {
    return [];
  }
}

/** The signed-in user's current pass (RLS: own rows), or null. */
export async function getMyMembership(): Promise<ActiveMembership | null> {
  try {
    const now = new Date().toISOString();
    const { data } = await (await createClient())
      .from('memberships')
      .select('id, starts_at, ends_at, download_limit, downloads_used, includes_commercial, membership_plans(name)')
      .eq('status', 'active')
      .gt('ends_at', now)
      .order('ends_at', { ascending: false })
      .returns<(Omit<ActiveMembership, 'plan_name'> & { membership_plans: { name: string } | null })[]>();
    const rows = data ?? [];
    if (rows.length === 0) return null;
    // Combined view across stacked passes: latest end, summed allowance.
    const latest = rows[0]!;
    return {
      id: latest.id,
      starts_at: rows[rows.length - 1]!.starts_at,
      ends_at: latest.ends_at,
      download_limit: rows.reduce((s, r) => s + r.download_limit, 0),
      downloads_used: rows.reduce((s, r) => s + r.downloads_used, 0),
      includes_commercial: rows.some((r) => r.includes_commercial),
      plan_name: latest.membership_plans?.name ?? null,
    };
  } catch {
    return null;
  }
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
