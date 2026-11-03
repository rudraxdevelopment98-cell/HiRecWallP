import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { listMyOrders } from '@/lib/orders';
import { formatMoneyMinor } from '@/lib/format';
import { TICKET_CATEGORIES, type TicketCategory } from '@/lib/support-rules';
import { NewTicketForm } from '@/components/support/new-ticket-form';

export const metadata: Metadata = { title: 'New support request' };
export const dynamic = 'force-dynamic';

export default async function NewTicketPage(props: { searchParams: Promise<{ order?: string; category?: string }> }) {
  await requireUser('/account/support/new');
  const sp = await props.searchParams;
  const orders = (await listMyOrders()).filter((o) => o.status !== 'created');
  const options = orders.map((o) => ({
    id: o.id,
    label: `${new Date(o.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · ${o.lines.map((l) => l.label).join(', ') || 'Order'} · ${formatMoneyMinor(o.amount_minor, o.currency)}${o.invoice_no ? ` · ${o.invoice_no}` : ''}`,
  }));
  const initialOrderId = options.some((o) => o.id === sp.order) ? sp.order : undefined;
  const initialCategory = (TICKET_CATEGORIES as readonly string[]).includes(sp.category ?? '') ? (sp.category as TicketCategory) : undefined;
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/account/support" className="text-sm text-muted-foreground hover:text-foreground">
          ← Help &amp; support
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold">New request</h1>
        <p className="text-sm text-muted-foreground">We reply within 48 hours, by email and here in your account.</p>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <NewTicketForm orders={options} initialOrderId={initialOrderId} initialCategory={initialCategory} />
      </div>
    </div>
  );
}
