import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { getPayoutProvider, type PayoutProviderId } from '@/lib/payouts';
import { getSettings } from '@/lib/settings';

/**
 * creator_payouts: compute each creator's monthly earnings and (on a live run)
 * trigger payouts.
 *
 * gross  = (credits spent on the creator's wallpapers + membership claims of
 *          them, each valued at `creator_credit_value_inr` per credit; a
 *          commercial-licence claim counts as 5 credits) + any legacy per-item
 *          INR sales, during the period
 * commission = gross × creators.commission_pct%
 * net    = gross − commission
 *
 * Idempotent on (creator_id, period); already-paid rows are not re-paid.
 * ⚠️ The credit value and marketplace TDS/TCS treatment are for CA review.
 */
function previousMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

interface ItemRow {
  unit_price: number | null;
  wallpaper_id: string | null;
  orders: { status: string; created_at: string; provider: string; currency: string } | null;
}

export async function runCreatorPayouts(opts: {
  period?: string;
  dryRun?: boolean;
}): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const period = opts.period ?? previousMonth();
  const dryRun = opts.dryRun ?? false;
  const { start, end } = periodRange(period);

  // Paid INR (money) order items in the period.
  const { data: items } = await supabase
    .from('order_items')
    .select('unit_price, wallpaper_id, orders!inner(status, created_at, provider, currency)')
    .eq('orders.status', 'paid')
    .eq('orders.provider', 'razorpay')
    .gte('orders.created_at', start)
    .lt('orders.created_at', end)
    .returns<ItemRow[]>();

  const rows = (items ?? []).filter((i) => i.wallpaper_id && i.unit_price != null);

  // Credit spends + membership claims in the period (library items by source).
  const creditValue = (await getSettings()).creator_credit_value_inr;
  const { data: ents } = await supabase
    .from('entitlements')
    .select('id, wallpaper_id, source, licence')
    .in('source', ['credits', 'membership'])
    .gte('created_at', start)
    .lt('created_at', end);
  const entRows = (ents ?? []) as { id: string; wallpaper_id: string; source: string; licence: string }[];
  const creditsByEnt = new Map<string, number>();
  const creditEnts = entRows.filter((e) => e.source === 'credits').map((e) => e.id);
  for (let i = 0; i < creditEnts.length; i += 200) {
    const { data: spends } = await supabase
      .from('credit_ledger')
      .select('ref_id, delta')
      .eq('reason', 'spend')
      .in('ref_id', creditEnts.slice(i, i + 200));
    for (const sp of spends ?? []) creditsByEnt.set(sp.ref_id as string, (creditsByEnt.get(sp.ref_id as string) ?? 0) - Number(sp.delta));
  }
  const valued = entRows.map((e) => ({
    wallpaper_id: e.wallpaper_id,
    amount: (e.source === 'credits' ? creditsByEnt.get(e.id) ?? 0 : e.licence === 'commercial' ? 5 : 1) * creditValue,
  }));

  if (rows.length === 0 && valued.length === 0) return { period, dryRun, creators: 0, note: 'no sales in period' };

  // Map wallpapers → creators.
  const wallpaperIds = [...new Set([...rows.map((r) => r.wallpaper_id!), ...valued.map((v) => v.wallpaper_id)])];
  const { data: wps } = await supabase
    .from('wallpapers')
    .select('id, creator_id')
    .in('id', wallpaperIds)
    .not('creator_id', 'is', null);
  const creatorOf = new Map((wps ?? []).map((w) => [w.id, w.creator_id as string]));

  const grossByCreator = new Map<string, number>();
  for (const r of rows) {
    const creatorId = creatorOf.get(r.wallpaper_id!);
    if (!creatorId) continue;
    grossByCreator.set(creatorId, (grossByCreator.get(creatorId) ?? 0) + Number(r.unit_price));
  }
  for (const v of valued) {
    const creatorId = creatorOf.get(v.wallpaper_id);
    if (!creatorId || v.amount <= 0) continue;
    grossByCreator.set(creatorId, Math.round(((grossByCreator.get(creatorId) ?? 0) + v.amount) * 100) / 100);
  }
  if (grossByCreator.size === 0) return { period, dryRun, creators: 0, note: 'no creator sales' };

  const { data: creators } = await supabase
    .from('creators')
    .select('user_id, commission_pct, payout_provider, payout_account_id, kyc_status')
    .in('user_id', [...grossByCreator.keys()]);
  const creatorMap = new Map((creators ?? []).map((c) => [c.user_id, c]));

  const results: Array<Record<string, unknown>> = [];
  for (const [creatorId, gross] of grossByCreator) {
    const c = creatorMap.get(creatorId);
    if (!c) continue;
    const pct = Number(c.commission_pct ?? 30);
    const commission = Math.round(gross * (pct / 100) * 100) / 100;
    const net = Math.round((gross - commission) * 100) / 100;

    // Upsert the payout record (idempotent per creator+period).
    const { data: existing } = await supabase
      .from('creator_payouts')
      .select('id, status')
      .eq('creator_id', creatorId)
      .eq('period', period)
      .maybeSingle();

    let status = existing?.status ?? 'pending';
    let providerRef: string | null = null;

    if (existing?.status === 'paid') {
      results.push({ creatorId, gross, commission, net, status: 'already_paid' });
      continue;
    }

    const { data: payoutRow } = await supabase
      .from('creator_payouts')
      .upsert(
        { creator_id: creatorId, period, gross, commission, net, currency: 'INR', status },
        { onConflict: 'creator_id,period' },
      )
      .select('id')
      .single();

    if (!dryRun && net > 0 && c.payout_account_id && c.kyc_status === 'verified' && payoutRow) {
      const payout = await getPayoutProvider(c.payout_provider as PayoutProviderId).createPayout({
        creatorAccountId: c.payout_account_id,
        amountMinor: Math.round(net * 100),
        currency: 'INR',
        reference: payoutRow.id,
      });
      status = payout.status === 'paid' ? 'paid' : payout.status === 'failed' ? 'failed' : 'processing';
      providerRef = payout.ref;
      await supabase
        .from('creator_payouts')
        .update({ status, provider_ref: providerRef })
        .eq('id', payoutRow.id);
    }

    results.push({ creatorId, gross, commission, net, status });
  }

  return { period, dryRun, creators: results.length, results };
}
