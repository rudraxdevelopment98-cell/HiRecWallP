import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { formatMoneyMinor } from '@/lib/format';
import Link from 'next/link';
import { RunJobButton } from '@/components/admin/run-job-button';
import { sumByCurrency } from '@/lib/admin';

interface Stats {
  revenue: Map<string, number>;
  paidOrders: number;
  published: number;
  drafts: number;
  creatorSubmissions: number;
  newMessages: number;
  openTakedowns: number;
  subscribers: number;
  members: number;
  recent: { id: string; amount_minor: number; currency: string; status: string; created_at: string }[];
  /** Paid orders per day, last 7 days (count — currencies differ). */
  weekly: number[];
}

async function loadStats(): Promise<Stats | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const head = { count: 'exact' as const, head: true };
    const [published, drafts, creatorSubs, orders, messages, takedowns, subs] = await Promise.all([
      supabase.from('wallpapers').select('id', head).eq('status', 'published'),
      supabase.from('wallpapers').select('id', head).eq('status', 'draft'),
      supabase.from('wallpapers').select('id', head).eq('status', 'pending_review').not('creator_id', 'is', null),
      supabase.from('orders').select('id, amount_minor, currency, status, created_at').eq('status', 'paid').order('created_at', { ascending: false }).limit(1000),
      supabase.from('contact_messages').select('id', head).eq('status', 'new'),
      supabase.from('takedown_reports').select('id', head).in('status', ['open', 'reviewing']),
      supabase.from('newsletter_subscribers').select('id', head),
    ]);
    const { count: members } = await supabase
      .from('memberships')
      .select('id', head)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString());
    const paid = orders.data ?? [];
    const weekly = Array.from({ length: 7 }, () => 0);
    const now = Date.now();
    for (const o of paid) {
      const days = Math.floor((now - new Date(o.created_at).getTime()) / 86_400_000);
      if (days >= 0 && days < 7) weekly[6 - days]! += 1;
    }
    return {
      revenue: sumByCurrency(paid),
      paidOrders: paid.length,
      published: published.count ?? 0,
      drafts: drafts.count ?? 0,
      creatorSubmissions: creatorSubs.count ?? 0,
      newMessages: messages.count ?? 0,
      openTakedowns: takedowns.count ?? 0,
      subscribers: subs.count ?? 0,
      members: members ?? 0,
      recent: paid.slice(0, 6),
      weekly,
    };
  } catch {
    return null;
  }
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const stats = await loadStats();
  const bars = stats?.weekly ?? Array.from({ length: 7 }, () => 0);
  const revenue = stats ? [...stats.revenue].map(([cur, minor]) => formatMoneyMinor(minor, cur)).join(' · ') : '';
  const dayLabel = (i: number) =>
    new Date(Date.now() - (6 - i) * 86_400_000).toLocaleDateString('en-IN', { weekday: 'short' });

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
        <Kpi label="Revenue (paid, all time)" value={revenue || '—'} />
        <Kpi label="Paid orders" value={stats ? String(stats.paidOrders) : '—'} />
        <Kpi label="Published" value={stats ? String(stats.published) : '—'} />
        <Kpi label="Drafts" value={stats ? String(stats.drafts) : '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Paid orders — last 7 days</h2>
          <div className="flex h-40 items-end gap-3">
            {bars.map((v, i) => {
              const max = Math.max(...bars, 1);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-primary/85 transition-[height]"
                    style={{ height: `${v === 0 ? 2 : Math.max(8, (v / max) * 100)}%` }}
                    title={`${v} order(s)`}
                  />
                  <span className="text-[10px] text-muted-foreground">{dayLabel(i)}</span>
                </div>
              );
            })}
          </div>
          {bars.every((v) => v === 0) && <p className="mt-3 text-xs text-muted-foreground">No paid orders in the last 7 days.</p>}
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Recent orders</h2>
          {!stats || stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid orders yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {stats.recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <Link href="/admin/orders" className="truncate text-muted-foreground hover:underline">
                    #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString('en-IN')}
                  </Link>
                  <span className="font-medium">{formatMoneyMinor(o.amount_minor, o.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Todo href="/admin/catalogue?status=pending_review" n={stats.creatorSubmissions} label="Creator submissions to review" />
          <Todo href="/admin/catalogue?status=draft" n={stats.drafts} label="Drafts not published" />
          <Todo href="/admin/messages" n={stats.newMessages + stats.openTakedowns} label="Messages & takedowns open" />
          <Todo href="/admin/newsletter" n={stats.subscribers} label="Newsletter subscribers" />
          <Todo href="/admin/membership" n={stats.members} label="Active members" />
          <Todo href="/admin/settings" n={0} label="Settings & controls" hideCount />
        </div>
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

function Todo({ href, n, label, hideCount }: { href: string; n: number; label: string; hideCount?: boolean }) {
  return (
    <Link href={href} className="rounded-2xl border bg-card p-4 text-sm hover:border-foreground/40">
      <p className="text-xl font-semibold">{hideCount ? '⚙︎' : n}</p>
      <p className="text-muted-foreground">{label} →</p>
    </Link>
  );
}
