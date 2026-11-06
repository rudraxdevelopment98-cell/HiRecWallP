import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { storage } from '@/lib/storage';
import { formatMoneyMinor } from '@/lib/format';
import { getSettings, sellerDetails } from '@/lib/settings';

export const dynamic = 'force-dynamic';

type Level = 'ok' | 'warn' | 'bad';
interface Check {
  label: string;
  level: Level;
  detail: string;
}

const DOT: Record<Level, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' };
const WORD: Record<Level, string> = { ok: 'OK', warn: 'Needs attention', bad: 'Not working' };

export default async function AdminHealthPage() {
  await requireAdmin();
  const e = process.env;
  const seller = sellerDetails(await getSettings(), '');
  const supabase = createServiceClient();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [db, stuck, hooks, jobs, failures] = await Promise.all([
    supabase.from('regions').select('code', { head: true, count: 'exact' }),
    supabase
      .from('orders')
      .select('id, created_at, amount_minor, currency, profiles!orders_user_id_fkey(email)')
      .eq('status', 'created')
      .not('provider_order_id', 'is', null)
      .lt('created_at', hourAgo)
      .gt('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('webhook_events').select('id', { head: true, count: 'exact' }).gt('processed_at', dayAgo),
    supabase.from('jobs_log').select('job_name, status, started_at, finished_at, details').order('started_at', { ascending: false }).limit(200),
    supabase.from('jobs_log').select('id', { head: true, count: 'exact' }).eq('status', 'failed').gt('started_at', weekAgo),
  ]);

  let storageCheck: Check;
  try {
    await storage().exists('public', '__health-check');
    storageCheck = {
      label: 'File storage',
      level: storage().id === 'supabase' ? 'warn' : 'ok',
      detail: storage().id === 'supabase' ? 'Supabase Storage (free: 1 GB, 50 MB/file). Move to R2 as the catalogue grows.' : 'Cloudflare R2',
    };
  } catch (err) {
    storageCheck = { label: 'File storage', level: 'bad', detail: err instanceof Error ? err.message : 'Unreachable' };
  }

  const key = e.RAZORPAY_KEY_ID ?? '';
  const checks: Check[] = [
    { label: 'Database', level: db.error ? 'bad' : 'ok', detail: db.error ? db.error.message : 'Connected (Supabase)' },
    storageCheck,
    {
      label: 'Payments (Razorpay)',
      level: !key || !e.RAZORPAY_KEY_SECRET ? 'bad' : key.startsWith('rzp_test_') ? 'warn' : 'ok',
      detail: !key ? 'Keys not set — checkout runs in demo mode' : key.startsWith('rzp_test_') ? 'Test mode — no real money moves' : 'Live mode',
    },
    {
      label: 'Payment confirmations (webhook)',
      level: e.RAZORPAY_WEBHOOK_SECRET ? 'ok' : key ? 'bad' : 'warn',
      detail: e.RAZORPAY_WEBHOOK_SECRET ? `${hooks.count ?? 0} received in the last 24 h` : 'RAZORPAY_WEBHOOK_SECRET not set — paid orders would never unlock',
    },
    { label: 'Email (Resend)', level: e.RESEND_API_KEY ? 'ok' : 'warn', detail: e.RESEND_API_KEY ? 'Configured' : 'Not set — weekly report and emails are skipped' },
    { label: 'Scheduled jobs', level: e.CRON_SECRET ? ((failures.count ?? 0) > 0 ? 'warn' : 'ok') : 'warn', detail: e.CRON_SECRET ? `${failures.count ?? 0} failed run(s) in 7 days` : 'CRON_SECRET not set — scheduled jobs can only be run by hand' },
    {
      label: 'Site address',
      level: (e.NEXT_PUBLIC_SITE_URL ?? '').includes('hirecwallp.com') ? 'ok' : 'warn',
      detail: e.NEXT_PUBLIC_SITE_URL ?? 'NEXT_PUBLIC_SITE_URL not set',
    },
    {
      label: 'Receipt seller details',
      level: seller.name && seller.address ? 'ok' : 'warn',
      detail: seller.name && seller.address ? `${seller.name}${seller.gstin ? ' · GSTIN set' : ' · no GSTIN'}` : 'Add your legal name and address in Settings → Business details (GSTIN once registered)',
    },
  ];

  // Latest run per job.
  const latest = new Map<string, { status: string; started_at: string; details: unknown }>();
  for (const j of (jobs.data ?? []) as { job_name: string; status: string; started_at: string; details: unknown }[]) {
    if (!latest.has(j.job_name)) latest.set(j.job_name, j);
  }
  const stuckRows = (stuck.data ?? []) as unknown as { id: string; created_at: string; amount_minor: number; currency: string; profiles: { email: string | null } | null }[];
  const worst: Level = checks.some((c) => c.level === 'bad') ? 'bad' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">System health</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[worst]}`} /> Overall: {WORD[worst]}
        </p>
      </div>

      <section className="divide-y admin-card">
        {checks.map((c) => (
          <div key={c.label} className="flex items-start gap-3 p-4 text-sm">
            <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.level]}`} />
            <div className="min-w-0">
              <p className="font-medium">
                {c.label} <span className="text-xs font-normal text-muted-foreground">· {WORD[c.level]}</span>
              </p>
              <p className="break-words text-muted-foreground">{c.detail}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-card p-5 text-sm">
        <h2 className="mb-1 font-semibold">Orders waiting for payment confirmation</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Checkout opened more than an hour ago and Razorpay never confirmed. Usually the customer just closed the window; if they say they paid, check the payment in the Razorpay dashboard.
        </p>
        {stuckRows.length === 0 ? (
          <p className="text-muted-foreground">None in the last 7 days.</p>
        ) : (
          <ul className="divide-y">
            {stuckRows.map((o) => (
              <li key={o.id} className="flex justify-between gap-2 py-2">
                <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                  {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {o.profiles?.email ?? '—'}
                </Link>
                <span className="tabular-nums">{formatMoneyMinor(o.amount_minor, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-card p-5 text-sm">
        <h2 className="mb-3 font-semibold">Scheduled jobs — last run</h2>
        {latest.size === 0 ? (
          <p className="text-muted-foreground">No job has run yet.</p>
        ) : (
          <ul className="divide-y">
            {[...latest].map(([name, j]) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono text-xs">{name}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {new Date(j.started_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  <span className={`inline-block h-2 w-2 rounded-full ${j.status === 'succeeded' ? DOT.ok : j.status === 'failed' ? DOT.bad : DOT.warn}`} />
                  {j.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
