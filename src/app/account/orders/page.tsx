import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { formatMoneyMinor } from '@/lib/format';
import { listMyOrders } from '@/lib/orders';

export const metadata: Metadata = { title: 'Orders & receipts' };

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  paid: { label: 'Paid', variant: 'default' },
  created: { label: 'Not completed', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'secondary' },
  refunded: { label: 'Refunded', variant: 'outline' },
};

export default async function OrdersPage() {
  const orders = await listMyOrders();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Orders &amp; receipts</h1>
        <p className="text-sm text-muted-foreground">Every purchase, with a printable receipt for paid orders.</p>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No orders yet. <Link href="/explore" className="underline">Browse wallpapers</Link>.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {orders.map((o) => {
            const s = STATUS[o.status] ?? STATUS.created!;
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {o.lines.map((l) => l.label).join(', ') || 'Order'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    {o.invoice_no && ` · ${o.invoice_no}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatMoneyMinor(o.amount_minor, o.currency)}</span>
                  <Badge variant={s.variant}>{s.label}</Badge>
                  {o.status === 'paid' && (
                    <Link href={`/account/orders/${o.id}`} className="underline">
                      Receipt
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
