import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

const TABS = ['paid', 'created', 'refunded', 'failed', 'all'] as const;
const PER_PAGE = 50;

interface Row {
  id: string;
  status: string;
  currency: string;
  amount_minor: number;
  billing_country: string | null;
  invoice_no: string | null;
  created_at: string;
  profiles: { email: string | null } | null;
  order_items: { licence: string | null; wallpapers: { title: string } | null; credit_packs: { credits: number } | null; membership_plans: { name: string } | null }[];
}

const itemLabel = (i: Row['order_items'][number]) =>
  i.credit_packs ? `${i.credit_packs.credits} credits` : i.membership_plans ? `Pass: ${i.membership_plans.name}` : `${i.wallpapers?.title ?? 'Wallpaper'}${i.licence === 'commercial' ? ' (commercial)' : ''}`;

export default async function AdminOrdersPage(props: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = (TABS as readonly string[]).includes(sp.status ?? '') ? sp.status! : 'paid';
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const select =
    'id, status, currency, amount_minor, billing_country, invoice_no, created_at, profiles!inner(email), order_items(licence, wallpapers(title), credit_packs(credits), membership_plans(name))';
  let query = createServiceClient()
    .from('orders')
    .select(select, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status !== 'all') query = query.eq('status', status);
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    if (/^HW-/i.test(safe)) query = query.ilike('invoice_no', `%${safe}%`);
    else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safe)) query = query.eq('id', safe);
    else query = query.ilike('profiles.email', `%${safe}%`);
  }
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Orders</h1>
        <a href={`/api/admin/orders/export?status=${status}`} className="rounded-full border px-4 py-2 text-sm hover:bg-secondary">
          Export CSV ({status})
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/orders?status=${t}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full border px-3 py-1 capitalize ${status === t ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
          >
            {t === 'created' ? 'not completed' : t}
          </Link>
        ))}
        <form action="/admin/orders" className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Email, invoice HW-… or order id" className="input h-8 w-64 py-1" aria-label="Search orders" />
        </form>
      </div>
      <p className="text-sm text-muted-foreground">{(count ?? 0).toLocaleString('en-IN')} order(s)</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No orders match.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Items</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-secondary/50">
                  <td className="whitespace-nowrap p-3">
                    <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                      {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Link>
                  </td>
                  <td className="p-3">
                    {o.profiles?.email ?? '—'}
                    {o.billing_country && <span className="text-muted-foreground"> · {o.billing_country}</span>}
                  </td>
                  <td className="max-w-xs truncate p-3">{o.order_items.map(itemLabel).join(', ')}</td>
                  <td className="whitespace-nowrap p-3 font-medium tabular-nums">{formatMoneyMinor(o.amount_minor, o.currency)}</td>
                  <td className="p-3">
                    <Badge variant={o.status === 'paid' ? 'default' : 'secondary'}>{o.status === 'created' ? 'not completed' : o.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{o.invoice_no ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} basePath="/admin/orders" query={{ status, q }} />
    </div>
  );
}
