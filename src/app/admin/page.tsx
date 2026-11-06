import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Crown,
  ExternalLink,
  Images,
  Inbox,
  Landmark,
  LifeBuoy,
  ListChecks,
  Palette,
  Receipt,
  Settings,
  ShieldAlert,
  Store,
  Upload,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { canAccessPath } from '@/lib/staff';
import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { formatMoneyMinor, formatRupees } from '@/lib/format';
import { getAdminCounts } from '@/lib/admin-counts';
import { getSettings, sellerDetails } from '@/lib/settings';
import { toInr } from '@/lib/jobs/creator-payouts';
import { RunJobButton } from '@/components/admin/run-job-button';
import { PageHeader, Section, Stat, StatGrid } from '@/components/admin/ui';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;
const CHART_DAYS = 14;

interface PaidOrder {
  id: string;
  amount_minor: number;
  currency: string;
  created_at: string;
}

interface Overview {
  revenue30: number | null;
  revenuePrev30: number | null;
  orders30: number;
  ordersPrev30: number;
  newCustomers30: number;
  members: number;
  published: number;
  drafts: number;
  failedJobs: number;
  daily: number[];
  recent: PaidOrder[];
}

async function loadOverview(rates: Record<string, number>): Promise<Overview | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const s = createServiceClient();
    const head = { count: 'exact' as const, head: true };
    const now = Date.now();
    const since60 = new Date(now - 60 * DAY).toISOString();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const [orders, published, drafts, customers, members, failed] = await Promise.all([
      s
        .from('orders')
        .select('id, amount_minor, currency, created_at')
        .eq('status', 'paid')
        .gte('created_at', since60)
        .order('created_at', { ascending: false })
        .limit(5000),
      s.from('wallpapers').select('id', head).eq('status', 'published'),
      s.from('wallpapers').select('id', head).eq('status', 'draft'),
      s.from('profiles').select('id', head).gte('created_at', since30),
      s
        .from('memberships')
        .select('id', head)
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString()),
      s
        .from('jobs_log')
        .select('id', head)
        .eq('status', 'failed')
        .gte('started_at', new Date(now - 7 * DAY).toISOString()),
    ]);
    const paid = (orders.data ?? []) as PaidOrder[];
    const age = (o: PaidOrder) => now - new Date(o.created_at).getTime();
    const last30 = paid.filter((o) => age(o) < 30 * DAY);
    const prev30 = paid.filter((o) => age(o) >= 30 * DAY);
    // Sum in rupees; null when a currency has no rate (shown as "—").
    const inr = (rows: PaidOrder[]) => {
      let total = 0;
      for (const o of rows) {
        const v = toInr(o.amount_minor, o.currency, rates);
        if (v == null) return null;
        total += v;
      }
      return total;
    };
    const daily = Array.from({ length: CHART_DAYS }, () => 0);
    for (const o of paid) {
      const d = Math.floor(age(o) / DAY);
      if (d >= 0 && d < CHART_DAYS) daily[CHART_DAYS - 1 - d]! += 1;
    }
    return {
      revenue30: inr(last30),
      revenuePrev30: inr(prev30),
      orders30: last30.length,
      ordersPrev30: prev30.length,
      newCustomers30: customers.count ?? 0,
      members: members.count ?? 0,
      published: published.count ?? 0,
      drafts: drafts.count ?? 0,
      failedJobs: failed.count ?? 0,
      daily,
      recent: paid.slice(0, 6),
    };
  } catch {
    return null;
  }
}

/** "+12% vs previous 30 days" hint with a tone. */
function trend(
  now: number | null,
  before: number | null,
): { hint: string; tone: 'default' | 'good' | 'bad' } {
  if (now == null || before == null) return { hint: 'Previous 30 days: —', tone: 'default' };
  if (before === 0)
    return {
      hint: now > 0 ? 'New this month' : 'No sales yet',
      tone: now > 0 ? 'good' : 'default',
    };
  const pct = Math.round(((now - before) / before) * 100);
  return {
    hint: `${pct >= 0 ? '+' : ''}${pct}% vs previous 30 days`,
    tone: pct > 0 ? 'good' : pct < 0 ? 'bad' : 'default',
  };
}

interface Todo {
  href: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  n?: number;
  urgent?: boolean;
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const me = await requireAdmin();
  const { denied } = await searchParams;
  // Only show what this staff role can open (src/lib/staff.ts).
  const can = (href: string) => canAccessPath(me.role, href.split('?')[0]!);
  const settings = await getSettings();
  const [o, counts] = await Promise.all([loadOverview(settings.fx_to_inr), getAdminCounts()]);
  const seller = sellerDetails(settings, '');
  const paymentsReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  // Work waiting on the owner, most urgent first.
  const todos: Todo[] = [];
  if (counts._supportOverdue > 0)
    todos.push({
      href: '/admin/support?tab=overdue',
      label: 'Support requests overdue',
      detail: 'Past the 48-hour reply or 1-month resolution deadline.',
      icon: LifeBuoy,
      n: counts._supportOverdue,
      urgent: true,
    });
  if (counts._support > 0)
    todos.push({
      href: '/admin/support',
      label: 'Support requests to answer',
      detail: 'Customers waiting for a reply.',
      icon: LifeBuoy,
      n: counts._support,
    });
  if (counts._takedowns > 0)
    todos.push({
      href: '/admin/messages',
      label: 'Takedown reports open',
      detail: 'Copyright/abuse reports — review quickly.',
      icon: ShieldAlert,
      n: counts._takedowns,
      urgent: true,
    });
  if (o && o.failedJobs > 0)
    todos.push({
      href: '/admin/health',
      label: 'Background jobs failed',
      detail: 'In the last 7 days — see System health.',
      icon: AlertTriangle,
      n: o.failedJobs,
      urgent: true,
    });
  if (counts._messages > 0)
    todos.push({
      href: '/admin/messages',
      label: 'New messages',
      detail: 'Customer contact form — reply within 48 hours.',
      icon: Inbox,
      n: counts._messages,
    });
  if (counts._submissions > 0)
    todos.push({
      href: '/admin/drafts?tab=creators',
      label: 'Wallpapers to review',
      detail: 'Creator uploads waiting for approval.',
      icon: Images,
      n: counts._submissions,
    });
  if (counts._review > 0)
    todos.push({
      href: '/admin/review-queue',
      label: 'AI images to review',
      detail: 'Generated images awaiting approve/reject.',
      icon: ListChecks,
      n: counts._review,
    });
  if (counts._kyc > 0)
    todos.push({
      href: '/admin/creators',
      label: 'Creator KYC pending',
      detail: 'Verify before their first payout.',
      icon: Palette,
      n: counts._kyc,
    });
  if (o && o.drafts > 0)
    todos.push({
      href: '/admin/drafts',
      label: 'Drafts not published',
      detail: 'Uploaded but not live yet.',
      icon: Images,
      n: o.drafts,
    });

  // One-time setup the store still needs.
  const setup: { label: string; done: boolean; href: string }[] = [
    {
      label: 'Publish your first wallpapers',
      done: (o?.published ?? 0) > 0,
      href: '/admin/upload',
    },
    { label: 'Payments connected (Razorpay keys)', done: paymentsReady, href: '/admin/health' },
    {
      label: 'Business name & address on receipts',
      done: Boolean(settings.business.legal_name && seller.address),
      href: '/admin/settings?tab=business',
    },
    {
      label: 'Grievance officer named (consumer law)',
      done: Boolean(settings.legal.grievance_name && settings.legal.grievance_email),
      href: '/admin/settings?tab=business',
    },
    { label: 'Store open for checkout', done: settings.store_open, href: '/admin/settings' },
  ];
  const setupLeft = setup.filter((x) => !x.done).length;

  const myTodos = todos.filter((t) => can(t.href));
  const mySetup = me.role === 'owner' || me.role === 'manager' ? setup : [];
  const rev = trend(o?.revenue30 ?? null, o?.revenuePrev30 ?? null);
  const ord = trend(o?.orders30 ?? null, o?.ordersPrev30 ?? null);
  const max = Math.max(...(o?.daily ?? [0]), 1);
  const dayLabel = (i: number) =>
    new Date(Date.now() - (CHART_DAYS - 1 - i) * DAY).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="What needs you today, and how the store is doing."
        actions={
          <>
            <Link href="/admin/upload" className="admin-btn-primary">
              <Upload className="h-4 w-4" /> Upload
            </Link>
            <Link href="/" target="_blank" className="admin-btn">
              <ExternalLink className="h-4 w-4" /> View store
            </Link>
          </>
        }
      />

      {denied && (
        <p className="admin-card border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your staff role doesn’t include that page. Ask the owner if you need it.
        </p>
      )}

      {!o && (
        <p className="admin-card p-4 text-sm text-muted-foreground">
          The database isn’t connected, so live numbers can’t be shown. Check System health.
        </p>
      )}

      {can('/admin/orders') && (
        <StatGrid>
          <Stat
            label="Revenue · 30 days"
            icon={Receipt}
            value={o?.revenue30 != null ? formatRupees(o.revenue30) : '—'}
            hint={rev.hint}
            tone={rev.tone}
            href="/admin/analytics"
          />
          <Stat
            label="Paid orders · 30 days"
            icon={Coins}
            value={o ? o.orders30 : '—'}
            hint={ord.hint}
            tone={ord.tone}
            href="/admin/orders"
          />
          <Stat
            label="New customers · 30 days"
            icon={Users}
            value={o ? o.newCustomers30 : '—'}
            hint={o ? `${o.members} active member${o.members === 1 ? '' : 's'}` : undefined}
            href="/admin/customers"
          />
          <Stat
            label="Live wallpapers"
            icon={Images}
            value={o ? o.published : '—'}
            hint={
              o && o.drafts > 0
                ? `${o.drafts} draft${o.drafts === 1 ? '' : 's'} waiting`
                : 'All uploads are live'
            }
            tone={o && o.drafts > 0 ? 'warn' : 'default'}
            href="/admin/catalogue"
          />
        </StatGrid>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section
          title="Needs attention"
          description={myTodos.length ? 'Most urgent first.' : undefined}
          flush
        >
          {myTodos.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> You’re all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {myTodos.map((t) => (
                <li key={t.label}>
                  <Link
                    href={t.href}
                    className="group flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/50"
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                        t.urgent
                          ? 'bg-rose-500/10 text-rose-700'
                          : 'bg-amber-500/10 text-amber-700',
                      )}
                    >
                      <t.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.detail}
                      </span>
                    </span>
                    {t.n != null && (
                      <span className="font-display text-lg font-semibold tabular-nums">{t.n}</span>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {mySetup.length > 0 && (
          <Section
            title="Store setup"
            description={
              setupLeft
                ? `${setupLeft} step${setupLeft === 1 ? '' : 's'} left before launch.`
                : 'Everything is set up.'
            }
            flush
          >
            <ul className="divide-y">
              {mySetup.map((x) => (
                <li key={x.label}>
                  <Link
                    href={x.href}
                    className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-secondary/50"
                  >
                    {x.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40"
                      />
                    )}
                    <span
                      className={cn(
                        'flex-1',
                        x.done &&
                          'text-muted-foreground line-through decoration-muted-foreground/40',
                      )}
                    >
                      {x.label}
                    </span>
                    {!x.done && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {can('/admin/orders') && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Section
            title="Paid orders"
            description={`Last ${CHART_DAYS} days`}
            actions={
              <Link
                href="/admin/analytics"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Analytics →
              </Link>
            }
          >
            <div
              className="flex h-44 items-end gap-1.5"
              role="img"
              aria-label={`Paid orders per day, last ${CHART_DAYS} days`}
            >
              {(o?.daily ?? Array.from({ length: CHART_DAYS }, () => 0)).map((v, i) => (
                <div
                  key={i}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                >
                  {v > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">{v}</span>
                  )}
                  <div
                    className={cn('w-full rounded-t', v > 0 ? 'bg-foreground/80' : 'bg-secondary')}
                    style={{ height: `${v === 0 ? 3 : Math.max(8, (v / max) * 85)}%` }}
                    title={`${dayLabel(i)}: ${v} order(s)`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{dayLabel(0)}</span>
              <span>{dayLabel(Math.floor(CHART_DAYS / 2))}</span>
              <span>Today</span>
            </div>
          </Section>

          <Section
            title="Recent orders"
            actions={
              <Link
                href="/admin/orders"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                All orders →
              </Link>
            }
            flush
          >
            {!o || o.recent.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No paid orders yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {o.recent.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/orders/${r.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-secondary/50"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs">#{r.id.slice(0, 8)}</span>
                        <span className="ml-2 text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoneyMinor(r.amount_minor, r.currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      <Section title="Shortcuts">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/admin/catalogue', label: 'Wallpapers', icon: Images },
            { href: '/admin/credit-packs', label: 'Credit packs', icon: Coins },
            { href: '/admin/membership', label: 'Membership plans', icon: Crown },
            { href: '/admin/countries', label: 'Pricing by country', icon: Store },
            { href: '/admin/tax', label: 'Tax centre', icon: Landmark },
            { href: '/admin/settings', label: 'Settings', icon: Settings },
            { href: '/admin/health', label: 'System health', icon: Wrench },
          ]
            .filter((x) => can(x.href))
            .map((x) => (
              <Link
                key={x.href}
                href={x.href}
                className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm hover:bg-secondary"
              >
                <x.icon className="h-4 w-4 text-muted-foreground" /> {x.label}
              </Link>
            ))}
          {can('/admin/tax') && (
            <div className="flex items-center">
              <RunJobButton
                label="Run creator payouts"
                variant="outline"
                endpoint="/api/jobs/creator-payouts"
                confirm="Compute and send this month’s creator payouts now?"
              />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
