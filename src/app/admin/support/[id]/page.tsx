import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { TICKET_FIELDS, type Ticket, type TicketMessage } from '@/lib/support';
import { CATEGORY_LABEL, isOverdue, SLA_LABEL, slaState, STAFF_STATUS_LABEL, ticketRef } from '@/lib/support-rules';
import { selfRefundDecision, type RefundFacts } from '@/lib/refund-rules';
import { formatMoneyMinor } from '@/lib/format';
import { DetailList, PageHeader, Section } from '@/components/admin/ui';
import { TicketAction, TicketComposer } from '@/components/admin/ticket-actions';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Support ticket' };

const when = (d: string | null) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

interface Ent {
  id: string;
  downloads_used: number;
  max_downloads: number;
  licence: string;
  wallpapers: { title: string } | null;
}

export default async function AdminTicketPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = createServiceClient();
  const { data: t } = await s.from('support_tickets').select(TICKET_FIELDS).eq('id', id).maybeSingle<Ticket>();
  if (!t) notFound();

  const [{ data: msgs }, { data: customer }, { data: order }, { data: facts }, { data: ents }, { count: otherTickets }] = await Promise.all([
    s.from('support_messages').select('id, author_role, author_id, body, internal, created_at').eq('ticket_id', t.id).order('created_at'),
    s.from('profiles').select('id, email, display_name, created_at').eq('id', t.user_id).maybeSingle(),
    t.order_id ? s.from('orders').select('id, status, currency, amount_minor, invoice_no, created_at, provider_payment_id').eq('id', t.order_id).maybeSingle() : Promise.resolve({ data: null }),
    t.order_id ? s.rpc('refund_facts', { p_order: t.order_id }) : Promise.resolve({ data: null }),
    (() => {
      let q = s.from('entitlements').select('id, downloads_used, max_downloads, licence, wallpapers(title)').eq('user_id', t.user_id).order('created_at', { ascending: false }).limit(8);
      if (t.wallpaper_id) q = q.eq('wallpaper_id', t.wallpaper_id);
      return q;
    })(),
    s.from('support_tickets').select('id', { count: 'exact', head: true }).eq('user_id', t.user_id).neq('id', t.id),
  ]);
  const messages = (msgs ?? []) as TicketMessage[];
  const entitlements = (ents ?? []) as unknown as Ent[];
  const sla = slaState(t);
  const decision = facts ? selfRefundDecision(facts as RefundFacts) : null;
  const done = t.status === 'resolved' || t.status === 'closed';

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/admin/support', label: 'Support' }}
        title={t.subject}
        description={
          <>
            <span className="font-mono">{ticketRef(t.number)}</span> · {CATEGORY_LABEL[t.category]} · {STAFF_STATUS_LABEL[t.status]}
            {t.priority === 'high' && <span className="ml-2 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">High priority</span>}
            {SLA_LABEL[sla] && <span className={cn('ml-2 text-xs font-semibold', isOverdue(sla) ? 'text-rose-700' : 'text-amber-700')}>{SLA_LABEL[sla]}</span>}
          </>
        }
        actions={
          <>
            {!done && <TicketAction ticketId={t.id} label="Mark resolved" payload={{ action: 'status', status: 'resolved' }} variant="default" />}
            {done && <TicketAction ticketId={t.id} label="Reopen" payload={{ action: 'status', status: 'open' }} />}
            {t.status !== 'closed' && <TicketAction ticketId={t.id} label="Close" payload={{ action: 'status', status: 'closed' }} confirm="Close this ticket? The customer can no longer reply to it." />}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ol className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'rounded-xl border p-4 text-sm',
                  m.author_role === 'customer' && 'bg-card',
                  m.author_role === 'staff' && !m.internal && 'border-foreground/15 bg-secondary/60',
                  m.internal && 'border-amber-300 bg-amber-50',
                  m.author_role === 'system' && !m.internal && 'border-dashed text-muted-foreground',
                )}
              >
                <p className="mb-1 text-xs text-muted-foreground">
                  {m.author_role === 'customer' ? (customer?.email ?? 'Customer') : m.author_role === 'staff' ? 'Staff' : 'System'}
                  {m.internal && ' · internal note'} · {when(m.created_at)}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            ))}
          </ol>
          <Section title="Respond">
            <TicketComposer ticketId={t.id} status={t.status} />
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Customer">
            <DetailList
              items={[
                ['Email', customer?.email ? <Link key="c" href={`/admin/customers/${t.user_id}`} className="underline">{customer.email as string}</Link> : '—'],
                ['Joined', when((customer?.created_at as string | undefined) ?? null)],
                ['Other tickets', String(otherTickets ?? 0)],
              ]}
            />
          </Section>

          <Section title="Deadlines">
            <DetailList
              items={[
                ['Opened', when(t.created_at)],
                ['Reply by', t.first_response_at ? `Replied ${when(t.first_response_at)}` : when(t.ack_due_at)],
                ['Resolve by', when(t.resolve_due_at)],
                ['Resolved', when(t.resolved_at)],
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <TicketAction ticketId={t.id} label={t.assigned_to ? 'Unassign' : 'Assign to me'} payload={{ action: 'assign', toMe: !t.assigned_to }} />
              <TicketAction ticketId={t.id} label={t.priority === 'high' ? 'Normal priority' : 'High priority'} payload={{ action: 'priority', priority: t.priority === 'high' ? 'normal' : 'high' }} />
            </div>
          </Section>

          {order && (
            <Section title="Order" actions={<Link href={`/admin/orders/${order.id}`} className="text-sm text-muted-foreground hover:text-foreground">Open →</Link>}>
              <DetailList
                items={[
                  ['Amount', formatMoneyMinor(order.amount_minor as number, order.currency as string)],
                  ['Status', order.status as string],
                  ['Date', when(order.created_at as string)],
                  ['Invoice', (order.invoice_no as string | null) ?? '—'],
                ]}
              />
              {order.status === 'paid' && (
                <div className="mt-3 space-y-2">
                  <p className={cn('rounded-lg p-2.5 text-xs', decision?.eligible ? 'bg-emerald-50 text-emerald-900' : 'bg-secondary/60 text-muted-foreground')}>
                    {decision?.eligible ? `Policy: eligible for a full refund. ${decision.summary}` : `Policy: ${decision && !decision.eligible ? decision.reason : 'check manually.'}`}
                  </p>
                  <TicketAction
                    ticketId={t.id}
                    label="Refund via Razorpay"
                    payload={{ action: 'refund', viaProvider: true }}
                    fields={[{ name: 'reason', label: 'Reason (shown in the audit log)', placeholder: 'e.g. faulty 4K file', required: true }]}
                  />
                  <TicketAction
                    ticketId={t.id}
                    label="Remove access only"
                    payload={{ action: 'refund', viaProvider: false }}
                    fields={[{ name: 'reason', label: 'Reason — use after refunding in the Razorpay dashboard', required: true }]}
                  />
                </div>
              )}
            </Section>
          )}

          <Section title="Make it right">
            <div className="space-y-3">
              <TicketAction
                ticketId={t.id}
                label="Add credits"
                payload={{ action: 'credits' }}
                fields={[
                  { name: 'amount', label: 'Credits', type: 'number', placeholder: '1', required: true },
                  { name: 'note', label: 'Note for the customer (optional)', placeholder: 'sorry for the trouble' },
                ]}
              />
              {entitlements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Restore downloads</p>
                  <ul className="divide-y rounded-lg border text-sm">
                    {entitlements.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="min-w-0 truncate">
                          {e.wallpapers?.title ?? 'Wallpaper'}
                          <span className="block text-xs text-muted-foreground">
                            {e.downloads_used}/{e.max_downloads} used · {e.licence}
                          </span>
                        </span>
                        {e.downloads_used > 0 && <TicketAction ticketId={t.id} label="Restore" payload={{ action: 'restore_downloads', entitlementId: e.id }} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
