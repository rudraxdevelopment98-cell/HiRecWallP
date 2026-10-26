import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { REGION_CODES, type RegionCode } from '@/lib/geo';

/**
 * dynamic_pricing: nightly per-wallpaper-per-region price adjustment.
 *
 * Implements the spec algorithm: demand + conversion vs category medians,
 * snap-point moves bounded by max_step_pct, launch-price window, cooldown,
 * freeze, and a two-consecutive-runs guard before any price drop (tracked via
 * a `down_pending` price_history marker). `dryRun` returns the diff without
 * writing; a live run writes prices + price_history with reasons + metrics.
 */

interface Rule {
  scope: 'global' | 'category' | 'wallpaper';
  scope_id: string | null;
  region_code: string;
  min_price: number;
  max_price: number;
  base_price: number;
  launch_price: number | null;
  snap_points: number[];
  max_step_pct: number;
  cooldown_hours: number;
  launch_hours: number;
  frozen: boolean;
}

export interface PriceChange {
  wallpaperId: string;
  slug: string;
  region: RegionCode;
  oldPrice: number;
  newPrice: number;
  reason: string;
  metrics: Record<string, number>;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function snapMove(snaps: number[], current: number, dir: 1 | -1): number {
  if (snaps.length === 0) return current;
  const sorted = [...snaps].sort((a, b) => a - b);
  // nearest index to current
  let idx = 0;
  let bestDiff = Infinity;
  sorted.forEach((p, i) => {
    const d = Math.abs(p - current);
    if (d < bestDiff) {
      bestDiff = d;
      idx = i;
    }
  });
  const next = Math.min(Math.max(idx + dir, 0), sorted.length - 1);
  return sorted[next]!;
}

export async function runDynamicPricing(opts: { dryRun: boolean }): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [{ data: wallpapers }, { data: rules }, { data: prices }, { data: events }, { data: downloads }, { data: history }] =
    await Promise.all([
      supabase.from('wallpapers').select('id, slug, category_id, launch_at, is_free').eq('status', 'published'),
      supabase.from('price_rules').select('*'),
      supabase.from('prices').select('wallpaper_id, region_code, current_price, last_changed_at'),
      supabase.from('events').select('wallpaper_id').eq('type', 'detail_view').gte('created_at', since),
      supabase.from('downloads').select('wallpaper_id, entitlement_id').gte('created_at', since),
      supabase.from('price_history').select('wallpaper_id, region_code, reason, created_at').gte('created_at', since).order('created_at', { ascending: false }),
    ]);

  const ruleList = (rules ?? []) as Rule[];
  const priceMap = new Map<string, { price: number; lastChanged: string }>();
  for (const p of prices ?? []) priceMap.set(`${p.wallpaper_id}:${p.region_code}`, { price: Number(p.current_price), lastChanged: p.last_changed_at });

  const detailViews = new Map<string, number>();
  for (const e of events ?? []) if (e.wallpaper_id) detailViews.set(e.wallpaper_id, (detailViews.get(e.wallpaper_id) ?? 0) + 1);

  const paid = new Map<string, number>();
  const free = new Map<string, number>();
  for (const d of downloads ?? []) {
    const m = d.entitlement_id ? paid : free;
    m.set(d.wallpaper_id, (m.get(d.wallpaper_id) ?? 0) + 1);
  }

  // Latest price_history reason per wallpaper:region (for the down_pending guard).
  const lastReason = new Map<string, string>();
  for (const h of history ?? []) {
    const k = `${h.wallpaper_id}:${h.region_code}`;
    if (!lastReason.has(k)) lastReason.set(k, h.reason ?? '');
  }

  const wl = wallpapers ?? [];

  // Per-wallpaper demand metric + conversion, then category medians.
  const demandMetric = new Map<string, number>();
  const conversion = new Map<string, number>();
  for (const w of wl) {
    const dv = detailViews.get(w.id) ?? 0;
    const p = paid.get(w.id) ?? 0;
    const f = free.get(w.id) ?? 0;
    demandMetric.set(w.id, p + 0.3 * f);
    conversion.set(w.id, dv > 0 ? p / dv : 0);
  }
  const byCat = new Map<string, string[]>();
  for (const w of wl) {
    const c = w.category_id ?? 'none';
    (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(w.id);
  }
  const catMedianMetric = new Map<string, number>();
  const catMedianConv = new Map<string, number>();
  for (const [c, ids] of byCat) {
    catMedianMetric.set(c, median(ids.map((id) => demandMetric.get(id) ?? 0)));
    catMedianConv.set(c, median(ids.map((id) => conversion.get(id) ?? 0)));
  }

  function resolveRule(wallpaperId: string, categoryId: string | null, region: string): Rule | null {
    return (
      ruleList.find((r) => r.region_code === region && r.scope === 'wallpaper' && r.scope_id === wallpaperId) ??
      (categoryId ? ruleList.find((r) => r.region_code === region && r.scope === 'category' && r.scope_id === categoryId) : undefined) ??
      ruleList.find((r) => r.region_code === region && r.scope === 'global') ??
      null
    );
  }

  const changes: PriceChange[] = [];
  const pendingMarkers: PriceChange[] = [];
  const now = Date.now();

  for (const w of wl) {
    const dv = detailViews.get(w.id) ?? 0;
    const metric = demandMetric.get(w.id) ?? 0;
    const conv = conversion.get(w.id) ?? 0;
    const cat = w.category_id ?? 'none';
    const medMetric = catMedianMetric.get(cat) ?? 0;
    const medConv = catMedianConv.get(cat) ?? 0;
    const demand = medMetric > 0 ? metric / medMetric : 0;
    const metrics = { detail_views_7d: dv, paid_7d: paid.get(w.id) ?? 0, free_7d: free.get(w.id) ?? 0, demand: Number(demand.toFixed(2)), conversion: Number(conv.toFixed(3)) };

    for (const region of REGION_CODES) {
      const rule = resolveRule(w.id, w.category_id, region);
      if (!rule) continue;
      const key = `${w.id}:${region}`;
      const cur = priceMap.get(key)?.price ?? rule.launch_price ?? rule.base_price;

      // Launch window → pin to launch price.
      if (w.launch_at && rule.launch_price != null) {
        const ageH = (now - new Date(w.launch_at).getTime()) / 3600_000;
        if (ageH < rule.launch_hours) {
          if (cur !== rule.launch_price) {
            changes.push({ wallpaperId: w.id, slug: w.slug, region, oldPrice: cur, newPrice: rule.launch_price, reason: 'launch window', metrics });
          }
          continue;
        }
      }
      if (rule.frozen) continue;

      const last = priceMap.get(key)?.lastChanged;
      if (last && (now - new Date(last).getTime()) / 3600_000 < rule.cooldown_hours) continue;

      if (dv < 30) continue; // require >= 30 detail views before acting

      let dir: 1 | -1 | 0 = 0;
      let reason = '';
      if (demand > 1.5 && conv >= medConv) {
        dir = 1;
        reason = `demand ${demand.toFixed(2)} > 1.5 and conversion >= category median`;
      } else if (demand < 0.5 || conv < 0.5 * medConv) {
        if ((lastReason.get(key) ?? '').startsWith('down_pending')) {
          dir = -1;
          reason = 'second consecutive low-demand run';
        } else {
          pendingMarkers.push({ wallpaperId: w.id, slug: w.slug, region, oldPrice: cur, newPrice: cur, reason: 'down_pending (1st low-demand run)', metrics });
          continue;
        }
      }
      if (dir === 0) continue;

      let next = snapMove(rule.snap_points, cur, dir);
      next = Math.min(Math.max(next, rule.min_price), rule.max_price);
      if (next === cur) continue;
      // Bound by max_step_pct.
      if (cur > 0 && (Math.abs(next - cur) / cur) * 100 > rule.max_step_pct) continue;

      changes.push({ wallpaperId: w.id, slug: w.slug, region, oldPrice: cur, newPrice: next, reason, metrics });
    }
  }

  if (!opts.dryRun) {
    for (const c of changes) {
      await supabase.from('prices').upsert(
        { wallpaper_id: c.wallpaperId, region_code: c.region, current_price: c.newPrice, last_changed_at: new Date().toISOString() },
        { onConflict: 'wallpaper_id,region_code' },
      );
      await supabase.from('price_history').insert({
        wallpaper_id: c.wallpaperId,
        region_code: c.region,
        old_price: c.oldPrice,
        new_price: c.newPrice,
        reason: c.reason,
        metrics: c.metrics,
        changed_by: 'job',
      });
    }
    for (const m of pendingMarkers) {
      await supabase.from('price_history').insert({
        wallpaper_id: m.wallpaperId,
        region_code: m.region,
        old_price: m.oldPrice,
        new_price: m.newPrice,
        reason: m.reason,
        metrics: m.metrics,
        changed_by: 'job',
      });
    }
  }

  return {
    dryRun: opts.dryRun,
    changes: changes.length,
    pending: pendingMarkers.length,
    diff: changes.slice(0, 50),
  };
}
