import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { listAuthUsers, sumByCurrency } from '@/lib/admin';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const TABS = ['paid', 'created', 'refunded', 'failed', 'all'] as const;

interface Row {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  currency: string;
  amount_minor: number;
  billing_country: string | null;
  invoice_no: string | null;
  created_at: string;
  order_items: { licence: string | null; wallpapers: { title: string } | null; credit_packs: { credits: number } | null }[];
}

export default async function AdminOrdersPage(props: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const status = (TABS as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status! : 'paid';
  let query = createServiceClient()
    .from('orders')
    .select('id, user_id, provider, status, currency, amount_minor, billing_country, invoice_no, created_at, order_items(licence, wallpapers(title), credit_packs(credits))')
    .order('created_at', { ascending: false })
    .limit(300);
  if (status !== 'all') query = query.eq('status', status);
  const [{ data }, users] = await Promise.all([query.returns<Row[]>(), listAuthUsers().catch(() => [])]);
  const rows = data ?? [];
  const email = new Map(users.map((u) => [u.id, u.email]));
  const totals = [...sumByCurrency(rows)].map(([c, m]) => formatMoneyMinor(m, c)).join(' · ');

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Orders</h1>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/orders?status=${t}`}
            className={`rounded-full border px-3 py-1 capitalize ${status === t ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
          >
            {t === 'created' ? 'not completed' : t}
          </Link>
        ))}
        <span className="ml-auto text-muted-foreground">
          {rows.length} order(s){totals && ` · ${totals}`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No orders here.</p>
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
                <tr key={o.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-3">{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="p-3">
                    {email.get(o.user_id) ?? o.user_id.slice(0, 8)}
                    {o.billing_country && <span className="text-muted-foreground"> · {o.billing_country}</span>}
                  </td>
                  <td className="max-w-xs p-3">
                    {o.order_items
                      .map((i) => (i.credit_packs ? `${i.credit_packs.credits} credits` : `${i.wallpapers?.title ?? 'Wallpaper'}${i.licence === 'commercial' ? ' (commercial)' : ''}`))
                      .join(', ')}
                  </td>
                  <td className="whitespace-nowrap p-3 font-medium">{formatMoneyMinor(o.amount_minor, o.currency)}</td>
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
    </div>
  );
}
