import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { TICKET_FIELDS, type Ticket } from '@/lib/support';
import { CATEGORY_LABEL, isOverdue, SLA_LABEL, slaState, STAFF_STATUS_LABEL, ticketRef } from '@/lib/support-rules';
import { EmptyState, FilterTabs, PageHeader } from '@/components/admin/ui';
import { Pagination } from '@/components/pagination';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Support' };

const TABS = [
  { key: 'open', label: 'Needs reply' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'waiting', label: 'Waiting on customer' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
] as const;
type Tab = (typeof TABS)[number]['key'];
const PER_PAGE = 50;

type Row = Ticket & { profiles: { email: string | null } | null };

const ago = (d: string) => {
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3_600_000);
  return h < 1 ? 'just now' : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

export default async function AdminSupportPage(props: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'open';
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const now = new Date().toISOString();
  const s = createServiceClient();

  let query = s
    .from('support_tickets')
    .select(`${TICKET_FIELDS}, profiles!support_tickets_user_id_fkey!inner(email)`, { count: 'exact' })
    .order('priority', { ascending: true })
    .order('last_message_at', { ascending: tab === 'open' || tab === 'overdue' })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (tab === 'open') query = query.eq('status', 'open');
  if (tab === 'waiting') query = query.eq('status', 'waiting_customer');
  if (tab === 'resolved') query = query.in('status', ['resolved', 'closed']);
  if (tab === 'overdue') {
    query = query
      .in('status', ['open', 'waiting_customer'])
      .or(`resolve_due_at.lt.${now},and(first_response_at.is.null,ack_due_at.lt.${now})`);
  }
  if (q) {
    const n = /^(?:HW-T)?(\d{3,9})$/i.exec(q)?.[1];
    if (n) query = query.eq('number', Number(n));
    else query = query.ilike('profiles.email', `%${q.replace(/[%,()]/g, ' ')}%`);
  }
  const [{ data, count }, openCount, waitingCount, overdueCount] = await Promise.all([
    query,
    s.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    s.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'waiting_customer'),
    s
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'waiting_customer'])
      .or(`resolve_due_at.lt.${now},and(first_response_at.is.null,ack_due_at.lt.${now})`),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const counts: Partial<Record<Tab, number>> = { open: openCount.count ?? 0, waiting: waitingCount.count ?? 0, overdue: overdueCount.count ?? 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Customer requests. The law asks us to acknowledge within 48 hours and resolve within a month — overdue ones are flagged. Money problems are marked high priority."
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          items={TABS.map((t) => ({
            href: t.key === 'open' ? '/admin/support' : `/admin/support?tab=${t.key}`,
            label: t.label,
            active: t.key === tab,
            count: counts[t.key],
          }))}
        />
        <form action="/admin/support" className="ml-auto">
          {tab !== 'open' && <input type="hidden" name="tab" value={tab} />}
          <input name="q" defaultValue={q} placeholder="HW-T1001 or customer email" className="input h-9 w-64 py-1" aria-label="Search tickets" />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={tab === 'open' ? 'No requests need a reply' : 'Nothing here'}
          description={q ? 'No tickets match that search.' : 'Customers open requests from Account → Help & support or “Get help” on an order.'}
        />
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last message</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const sla = slaState(t);
                return (
                  <tr key={t.id}>
                    <td className="max-w-sm">
                      <Link href={`/admin/support/${t.id}`} className="block font-medium hover:underline">
                        {t.priority === 'high' && <span className="mr-1.5 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">High</span>}
                        {t.subject}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">{ticketRef(t.number)}</span>
                    </td>
                    <td className="max-w-[14rem] truncate text-muted-foreground">{t.profiles?.email ?? '—'}</td>
                    <td className="whitespace-nowrap">{CATEGORY_LABEL[t.category]}</td>
                    <td className="whitespace-nowrap">{STAFF_STATUS_LABEL[t.status]}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{ago(t.last_message_at)}</td>
                    <td className={cn('whitespace-nowrap text-xs', isOverdue(sla) ? 'font-semibold text-rose-700' : 'text-amber-700')}>{SLA_LABEL[sla]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))} basePath="/admin/support" query={{ tab: tab === 'open' ? undefined : tab, q: q || undefined }} />
    </div>
  );
}
