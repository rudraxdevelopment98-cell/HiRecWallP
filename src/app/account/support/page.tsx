import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { listMyTickets } from '@/lib/support';
import { CATEGORY_LABEL, STATUS_LABEL, ticketRef } from '@/lib/support-rules';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Help & support' };
export const dynamic = 'force-dynamic';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export default async function SupportPage() {
  await requireUser('/account/support');
  const tickets = await listMyTickets();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Help &amp; support</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Problems with a download, a charge or a wallpaper? Open a request — we reply within 48 hours and resolve within a month at the
            latest. Unused packs and passes can be refunded instantly from <Link href="/account/orders" className="underline">Orders</Link>.
          </p>
        </div>
        <Link href="/account/support/new" className={buttonVariants({ size: 'sm' })}>
          New request
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">You haven’t opened any requests.</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/account/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm hover:bg-secondary/40">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t.customer_unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" aria-label="New reply" />}
                    {t.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ticketRef(t.number)} · {CATEGORY_LABEL[t.category]} · updated {fmt(t.last_message_at)}
                  </p>
                </div>
                <Badge variant={t.status === 'waiting_customer' ? 'default' : t.status === 'open' ? 'secondary' : 'outline'}>{STATUS_LABEL[t.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
