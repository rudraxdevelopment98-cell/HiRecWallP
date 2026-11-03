import { requireAdmin } from '@/lib/auth';
import { EmptyState, FilterTabs, PageHeader } from '@/components/admin/ui';
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
      <PageHeader
        title="Orders"
        description="Every checkout. Open an order for its receipt, payment id and refund."
        actions={
          <a href={`/api/admin/orders/export?status=${status}`} className="admin-btn">
            Export CSV
          </a>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          items={TABS.map((t) => ({
            href: `/admin/orders?status=${t}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
            label: t === 'created' ? 'not completed' : t,
            active: status === t,
          }))}
        />
        <form action="/admin/orders" className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Email, invoice HW-… or order id" className="input h-8 w-64 py-1" aria-label="Search orders" />
        </form>
      </div>
      <p className="text-sm text-muted-foreground">{(count ?? 0).toLocaleString('en-IN')} order(s)</p>
      {rows.length === 0 ? (
        <EmptyState title="No orders match" description={q ? 'Try another email, invoice number or order id.' : 'Orders appear here once customers check out.'} />
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                      {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Link>
                  </td>
                  <td >
                    {o.profiles?.email ?? '—'}
                    {o.billing_country && <span className="text-muted-foreground"> · {o.billing_country}</span>}
                  </td>
                  <td className="max-w-xs truncate">{o.order_items.map(itemLabel).join(', ')}</td>
                  <td className="whitespace-nowrap font-medium tabular-nums">{formatMoneyMinor(o.amount_minor, o.currency)}</td>
                  <td >
                    <Badge variant={o.status === 'paid' ? 'default' : 'secondary'}>{o.status === 'created' ? 'not completed' : o.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">{o.invoice_no ?? '—'}</td>
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
