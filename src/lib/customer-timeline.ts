import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { formatMoneyMinor } from '@/lib/format';
import { ticketRef } from '@/lib/support-rules';
import { creditEventTitle, mergeTimeline, signinTitle, staffActionTitle, type TimelineEvent } from '@/lib/timeline';

/** Everything that happened on one account, newest first (orders, credits, tickets, downloads, sign-ins, staff actions, emails). */
export async function customerTimeline(userId: string): Promise<TimelineEvent[]> {
  const s = createServiceClient();
  const [orders, ledger, tickets, downloads, signins, staff] = await Promise.all([
    s.from('orders').select('id, status, currency, amount_minor, created_at, paid_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
    s.from('credit_ledger').select('delta, reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
    s.from('support_tickets').select('id, number, subject, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    s.from('downloads').select('created_at, fit_size, wallpapers(title), wallpaper_assets(variant)').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    s.rpc('admin_login_events', { p_user: userId, p_limit: 30 }),
    s.from('admin_audit').select('action, actor_email, details, created_at').eq('target_type', 'user').eq('target_id', userId).order('created_at', { ascending: false }).limit(30),
  ]);

  const out: TimelineEvent[][] = [];
  out.push(
    (orders.data ?? []).map((o) => ({
      at: (o.paid_at as string | null) ?? (o.created_at as string),
      kind: 'order' as const,
      title: `Order ${o.status as string} · ${formatMoneyMinor(Number(o.amount_minor), o.currency as string)}`,
      href: `/admin/orders/${o.id as string}`,
    })),
  );
  out.push(
    (ledger.data ?? []).map((l) => ({ at: l.created_at as string, kind: 'credit' as const, title: creditEventTitle(Number(l.delta), l.reason as string) })),
  );
  out.push(
    (tickets.data ?? []).map((t) => ({
      at: t.created_at as string,
      kind: 'ticket' as const,
      title: `Opened ${ticketRef(Number(t.number))}: ${t.subject as string}`,
      detail: `now ${(t.status as string).replace('_', ' ')}`,
      href: `/admin/support/${t.id as string}`,
    })),
  );
  out.push(
    (downloads.data ?? []).map((d) => {
      const w = d.wallpapers as unknown as { title: string } | null;
      const a = d.wallpaper_assets as unknown as { variant: string } | null;
      return { at: d.created_at as string, kind: 'download' as const, title: `Downloaded ${w?.title ?? 'a wallpaper'}`, detail: (d.fit_size as string | null) ? `exact fit ${d.fit_size as string}` : a?.variant };
    }),
  );
  out.push(((signins.data ?? []) as { at: string; action: string }[]).map((e) => ({ at: e.at, kind: 'signin' as const, title: signinTitle(e.action) })));
  out.push(
    (staff.data ?? []).map((a) => {
      const details = (a.details ?? {}) as Record<string, unknown>;
      const email = a.action === 'customer.email';
      return {
        at: a.created_at as string,
        kind: email ? ('email' as const) : ('staff' as const),
        title: email ? `Emailed by staff: “${String(details.subject ?? '')}”` : staffActionTitle(a.action as string),
        detail: (a.actor_email as string | null) ?? 'system',
      };
    }),
  );
  return mergeTimeline(out, 120);
}
