import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { formatMoneyMinor } from '@/lib/format';
import { listMyOrders } from '@/lib/orders';
import { selfRefundOption } from '@/lib/self-refund';
import { RefundButton } from '@/components/support/refund-button';
import type { RefundDecision } from '@/lib/refund-rules';

export const metadata: Metadata = { title: 'Orders & receipts' };

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  paid: { label: 'Paid', variant: 'default' },
  created: { label: 'Not completed', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'secondary' },
  refunded: { label: 'Refunded', variant: 'outline' },
};

export default async function OrdersPage() {
  const user = await requireUser('/account/orders');
  const orders = await listMyOrders();
  // Instant-refund options for recent paid orders (the longest self-serve window is 14 days).
  const recent = orders.filter((o) => o.status === 'paid' && Date.now() - new Date(o.paid_at ?? o.created_at).getTime() < 15 * 86_400_000);
  const options = new Map<string, RefundDecision | null>(
    await Promise.all(recent.map(async (o) => [o.id, await selfRefundOption(o.id, user.id).catch(() => null)] as const)),
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Orders &amp; receipts</h1>
        <p className="text-sm text-muted-foreground">
          Every purchase, with a printable receipt for paid orders. Problem with one? Use <strong>Get help</strong> — see the{' '}
          <Link href="/refunds" className="underline">Refund Policy</Link>.
        </p>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No orders yet. <Link href="/explore" className="underline">Browse wallpapers</Link>.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {orders.map((o) => {
            const s = STATUS[o.status] ?? STATUS.created!;
            const refund = options.get(o.id);
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
                  {o.status !== 'created' && (
                    <Link href={`/account/support/new?order=${o.id}`} className="underline">
                      Get help
                    </Link>
                  )}
                </div>
                {refund?.eligible && (
                  <div className="flex w-full justify-end">
                    <RefundButton orderId={o.id} summary={refund.summary} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
