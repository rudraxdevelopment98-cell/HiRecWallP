import { requireAdmin } from '@/lib/auth';
import { FilterTabs, PageHeader } from '@/components/admin/ui';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { formatMoneyMinor } from '@/lib/format';
import { BarChart } from '@/components/admin/bar-chart';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90, 365] as const;
const FUNNEL = [
  { type: 'view', label: 'Visited home/explore' },
  { type: 'detail_view', label: 'Opened a wallpaper' },
  { type: 'add_to_cart', label: 'Added to cart' },
  { type: 'checkout_start', label: 'Started checkout' },
  { type: 'purchase', label: 'Bought (per wallpaper)' },
];

export default async function AdminAnalyticsPage(props: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const days = (RANGES as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 30;
  const from = new Date(Date.now() - days * 86_400_000);
  from.setHours(0, 0, 0, 0);
  const fromIso = from.toISOString();

  const supabase = createServiceClient();
  const [sales, funnel, sellers, viewed, countries] = await Promise.all([
    supabase.rpc('admin_sales_daily', { p_from: fromIso }),
    supabase.rpc('admin_funnel', { p_from: fromIso }),
    supabase.rpc('admin_top_sellers', { p_from: fromIso, p_limit: 10 }),
    supabase.rpc('admin_top_viewed', { p_from: fromIso, p_limit: 10 }),
    supabase.rpc('admin_sales_by_country', { p_from: fromIso }),
  ]);
  type SaleRow = { day: string; currency: string; orders: number; revenue_minor: number };
  const saleRows = (sales.data ?? []) as SaleRow[];
  const currencies = [...new Set(saleRows.map((r) => r.currency))];

  // Continuous day axis so quiet days show as zero.
  const dayKeys = Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + (i + 1) * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const label = (k: string) => new Date(k).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const ordersPerDay = dayKeys.map((k) => ({
    label: label(k),
    value: saleRows.filter((r) => r.day === k).reduce((s, r) => s + Number(r.orders), 0),
  }));

  const totals = currencies.map((c) => {
    const rows = saleRows.filter((r) => r.currency === c);
    const revenue = rows.reduce((s, r) => s + Number(r.revenue_minor), 0);
    const orders = rows.reduce((s, r) => s + Number(r.orders), 0);
    return { currency: c, revenue, orders, aov: orders ? Math.round(revenue / orders) : 0 };
  });
  const totalOrders = totals.reduce((s, t) => s + t.orders, 0);

  const counts = new Map(((funnel.data ?? []) as { type: string; total: number }[]).map((r) => [r.type, Number(r.total)]));
  const top = Math.max(1, ...FUNNEL.map((f) => counts.get(f.type) ?? 0));
  const detail = counts.get('detail_view') ?? 0;
  const bought = counts.get('purchase') ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Sales, top wallpapers and the buying funnel since ${from.toLocaleDateString('en-IN', { dateStyle: 'medium' })}.`}
        actions={<FilterTabs items={RANGES.map((r) => ({ href: `/admin/analytics?days=${r}`, label: r === 365 ? '1 year' : `${r} days`, active: r === days }))} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Paid orders" value={String(totalOrders)} />
        {totals.length === 0 ? (
          <Kpi label="Revenue" value="—" />
        ) : (
          totals.map((t) => (
            <Kpi key={t.currency} label={`Revenue (${t.currency})`} value={formatMoneyMinor(t.revenue, t.currency)} sub={`avg order ${formatMoneyMinor(t.aov, t.currency)}`} />
          ))
        )}
        <Kpi label="Opened → bought" value={detail ? `${((bought / detail) * 100).toFixed(1)}%` : '—'} sub="wallpaper page views that became a sale" />
      </div>

      <section className="admin-card p-6">
        <h2 className="mb-4 font-semibold">Paid orders per day</h2>
        <BarChart data={ordersPerDay} format={(v) => `${v}`} />
        {currencies.map((c) => (
          <div key={c} className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Revenue per day ({c})</h3>
            <BarChart
              height={110}
              data={dayKeys.map((k) => ({
                label: label(k),
                value: saleRows.filter((r) => r.day === k && r.currency === c).reduce((s, r) => s + Number(r.revenue_minor), 0),
              }))}
              format={(v) => formatMoneyMinor(v, c)}
            />
          </div>
        ))}
      </section>

      <section className="admin-card p-6">
        <h2 className="mb-1 font-semibold">Buying funnel</h2>
        <p className="mb-4 text-xs text-muted-foreground">How many times each step happened. Big drops show where people give up.</p>
        <div className="space-y-3">
          {FUNNEL.map((f, i) => {
            const n = counts.get(f.type) ?? 0;
            const prev = i > 0 ? (counts.get(FUNNEL[i - 1]!.type) ?? 0) : 0;
            return (
              <div key={f.type} className="text-sm">
                <div className="mb-1 flex justify-between gap-2">
                  <span>{f.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {n.toLocaleString('en-IN')}
                    {i > 0 && prev > 0 && ` · ${((n / prev) * 100).toFixed(0)}% of previous`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(n / top) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankTable title="Best sellers" rows={((sellers.data ?? []) as { wallpaper_id: string; title: string; slug: string; sales: number }[]).map((r) => ({ id: r.wallpaper_id, title: r.title, slug: r.slug, n: r.sales }))} unit="sold" />
        <RankTable title="Most viewed" rows={((viewed.data ?? []) as { wallpaper_id: string; title: string; slug: string; views: number }[]).map((r) => ({ id: r.wallpaper_id, title: r.title, slug: r.slug, n: Number(r.views) }))} unit="views" />
      </div>

      <section className="admin-card p-6">
        <h2 className="mb-3 font-semibold">Sales by billing country</h2>
        {((countries.data ?? []) as unknown[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid orders in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {((countries.data ?? []) as { country: string; currency: string; orders: number; revenue_minor: number }[]).map((r) => (
                  <tr key={`${r.country}-${r.currency}`}>
                    <td className="py-2">{r.country}</td>
                    <td className="py-2 font-mono tabular-nums">{r.orders}</td>
                    <td className="py-2 font-mono tabular-nums">{formatMoneyMinor(Number(r.revenue_minor), r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="admin-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RankTable({ title, rows, unit }: { title: string; rows: { id: string; title: string; slug: string; n: number }[]; unit: string }) {
  return (
    <section className="admin-card p-6">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for this period yet.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3">
              <span className="w-5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
              <Link href={`/admin/catalogue/${r.id}`} className="min-w-0 flex-1 truncate hover:underline">
                {r.title}
              </Link>
              <span className="font-mono tabular-nums text-muted-foreground">
                {r.n} {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
