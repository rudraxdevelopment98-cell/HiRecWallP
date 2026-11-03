import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getMyTicket, markSeenByCustomer } from '@/lib/support';
import { CATEGORY_LABEL, STATUS_LABEL, ticketRef } from '@/lib/support-rules';
import { Badge } from '@/components/ui/badge';
import { ReplyBox } from '@/components/support/reply-box';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Support request' };
export const dynamic = 'force-dynamic';

const when = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default async function TicketPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser('/account/support');
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await getMyTicket(id);
  if (!found) notFound();
  const { ticket: t, messages } = found;
  if (t.customer_unread) await markSeenByCustomer(t.id, user.id);
  const closed = t.status === 'closed';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/account/support" className="text-sm text-muted-foreground hover:text-foreground">
          ← Help &amp; support
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold">{t.subject}</h1>
          <Badge variant={t.status === 'waiting_customer' ? 'default' : 'outline'}>{STATUS_LABEL[t.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {ticketRef(t.number)} · {CATEGORY_LABEL[t.category]} · opened {when(t.created_at)}
          {t.order_id && (
            <>
              {' · '}
              <Link href={`/account/orders/${t.order_id}`} className="underline">
                order
              </Link>
            </>
          )}
        </p>
      </div>

      {isNew && t.status === 'open' && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          Thanks — your request {ticketRef(t.number)} is with us. We’ll reply within 48 hours and email you when we do.
        </p>
      )}

      <ol className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              'rounded-2xl border p-4 text-sm',
              m.author_role === 'customer' && 'bg-card',
              m.author_role === 'staff' && 'border-foreground/15 bg-secondary/50',
              m.author_role === 'system' && 'border-dashed bg-transparent text-muted-foreground',
            )}
          >
            <p className="mb-1 text-xs text-muted-foreground">
              {m.author_role === 'customer' ? 'You' : m.author_role === 'staff' ? 'HirecWallp support' : 'Update'} · {when(m.created_at)}
            </p>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
          </li>
        ))}
      </ol>

      {closed ? (
        <p className="text-sm text-muted-foreground">
          This request is closed. <Link href="/account/support/new" className="underline">Open a new one</Link> if you need more help.
        </p>
      ) : (
        <div className="rounded-2xl border bg-card p-5">
          <ReplyBox ticketId={t.id} resolved={t.status === 'resolved'} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Not happy with how a request was handled? You can escalate to our <Link href="/grievance" className="underline">Grievance Officer</Link>.
      </p>
    </div>
  );
}
