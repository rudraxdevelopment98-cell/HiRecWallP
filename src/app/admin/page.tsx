import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { formatMoneyMinor } from '@/lib/format';
import { RunJobButton } from '@/components/admin/run-job-button';

interface Stats {
  revenueMinor: number;
  paidOrders: number;
  published: number;
  creatorSubmissions: number;
  recent: { id: string; amount_minor: number; currency: string; status: string; created_at: string }[];
  weekly: number[];
}

async function loadStats(): Promise<Stats | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const [published, creatorSubs, orders] = await Promise.all([
      supabase.from('wallpapers').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('wallpapers').select('id', { count: 'exact', head: true }).eq('status', 'pending_review').not('creator_id', 'is', null),
      supabase.from('orders').select('id, amount_minor, currency, status, created_at').eq('status', 'paid').order('created_at', { ascending: false }).limit(50),
    ]);
    const paid = orders.data ?? [];
    const revenueMinor = paid.reduce((s, o) => s + o.amount_minor, 0);
    // last-7-day revenue buckets
    const weekly = Array.from({ length: 7 }, () => 0);
    const now = Date.now();
    for (const o of paid) {
      const days = Math.floor((now - new Date(o.created_at).getTime()) / 86_400_000);
      if (days >= 0 && days < 7) weekly[6 - days]! += o.amount_minor;
    }
    return {
      revenueMinor,
      paidOrders: paid.length,
      published: published.count ?? 0,
      creatorSubmissions: creatorSubs.count ?? 0,
      recent: paid.slice(0, 6),
      weekly,
    };
  } catch {
    return null;
  }
}

export default async function AdminOverviewPage() {
  const stats = await loadStats();
  // Demo bars when there's no data yet, so the chart isn't empty.
  const bars = stats && stats.weekly.some((v) => v > 0) ? stats.weekly : [40, 65, 52, 80, 72, 95, 88];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Store health at a glance.</p>
        </div>
        <RunJobButton label="Run creator payouts" variant="outline" endpoint="/api/jobs/creator-payouts" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue (paid)" value={stats ? formatMoneyMinor(stats.revenueMinor, stats.recent[0]?.currency ?? 'INR') : '—'} />
        <Kpi label="Paid orders" value={stats ? String(stats.paidOrders) : '—'} />
        <Kpi label="Published" value={stats ? String(stats.published) : '—'} />
        <Kpi label="Creator submissions" value={stats ? String(stats.creatorSubmissions) : '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Sales — last 7 days</h2>
          <div className="flex h-40 items-end gap-3">
            {bars.map((v, i) => {
              const max = Math.max(...bars, 1);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-primary/85 transition-[height]"
                    style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">D{i + 1}</span>
                </div>
              );
            })}
          </div>
          {!stats && <p className="mt-3 text-xs text-muted-foreground">Illustrative — connect Supabase for live sales.</p>}
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Recent orders</h2>
          {!stats || stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid orders yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {stats.recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <span className="truncate text-muted-foreground">#{o.id.slice(0, 8)}</span>
                  <span className="font-medium">{formatMoneyMinor(o.amount_minor, o.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {stats && stats.creatorSubmissions > 0 && (
        <p className="text-sm text-muted-foreground">
          {stats.creatorSubmissions} creator submission(s) awaiting review in <strong>Catalogue</strong>.
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
