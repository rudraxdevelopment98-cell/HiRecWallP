import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Crown, RefreshCw } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { CancelAutopayButton } from '@/components/account/cancel-autopay-button';
import { getMyAutopays, getMyPasses, PLAN_KIND_LABEL } from '@/lib/membership';
import { formatMoneyMinor } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Membership' };

export default async function MembershipPage(props: { searchParams: Promise<{ bought?: string }> }) {
  await requireUser('/account/membership');
  const searchParams = await props.searchParams;
  const [passes, autopays, settings] = await Promise.all([getMyPasses(), getMyAutopays(), getSettings()]);
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'long' });
  const now = Date.now();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">Membership</h1>
      {searchParams.bought === '1' && passes.length === 0 && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Payment received — your plan activates as soon as the bank confirms. Refresh in a few seconds.
        </p>
      )}

      {passes.map((m) => {
        const upcoming = new Date(m.starts_at).getTime() > now;
        const pct = Math.min(100, (m.used_this_period / m.allowance) * 100);
        return (
          <div key={m.id} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">
                  {m.plan_name ?? 'Membership'} · {upcoming ? 'starts ' + fmt(m.starts_at) : 'active'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {m.kind ? PLAN_KIND_LABEL[m.kind] + ' · ' : ''}
                  {m.category_name ? `${m.category_name} only · ` : ''}
                  {m.includes_commercial ? 'Commercial licence · ' : ''}
                  Valid until {fmt(m.ends_at)}
                </p>
              </div>
            </div>
            {!upcoming && (
              <div className="mt-5">
                <div className="mb-1 flex justify-between text-sm">
                  <span>Added this month</span>
                  <span className="font-medium">
                    {m.used_this_period} / {m.allowance}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Refreshes on {fmt(m.resets_at)} · unused wallpapers don&rsquo;t carry over</p>
              </div>
            )}
          </div>
        );
      })}

      {autopays.map((a) => (
        <div key={a.id} className="rounded-2xl border bg-card p-6 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <RefreshCw className="h-4 w-4" /> Autopay · {a.plan_name ?? 'Membership'}
          </p>
          <p className="mt-1 text-muted-foreground">
            {formatMoneyMinor(a.amount_minor, a.currency)} / month · {a.paid_count} of{' '}
            {a.total_count >= 120 ? 'unlimited' : a.total_count} payments made
            {a.current_end ? ` · current month ends ${fmt(a.current_end)}` : ''}
            {a.status === 'halted' && ' · last payment failed — update your payment method with your bank or UPI app'}
          </p>
          <div className="mt-3">
            {a.cancel_at_cycle_end ? (
              <p className="text-muted-foreground">Cancelled — no more charges. Your plan runs to the end of the paid month.</p>
            ) : (
              <CancelAutopayButton subscriptionId={a.id} until={a.current_end} />
            )}
          </div>
        </div>
      ))}

      {passes.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          <Link href="/explore" className={buttonVariants()}>
            Browse wallpapers
          </Link>
          {settings.membership_enabled && (
            <Link href="/pricing?tab=monthly" className={buttonVariants({ variant: 'outline' })}>
              Extend or change plan
            </Link>
          )}
          <p className="w-full text-sm text-muted-foreground">
            Open any premium wallpaper and press <strong>Add with membership</strong>. Wallpapers you add stay in your library forever.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 text-sm">
          <p className="font-medium">You don&rsquo;t have an active plan.</p>
          <p className="mt-1 text-muted-foreground">
            {settings.membership_enabled
              ? 'A plan gives you a fresh allowance of wallpapers every month — like a data plan for your screens.'
              : 'Memberships aren’t on sale at the moment.'}
          </p>
          {settings.membership_enabled && (
            <Link href="/pricing?tab=monthly" className={buttonVariants({ className: 'mt-4' })}>
              See plans
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
