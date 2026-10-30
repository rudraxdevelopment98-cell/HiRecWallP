import Link from 'next/link';
import type { Metadata } from 'next';
import { Crown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { getMyMembership } from '@/lib/membership';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Membership' };

export default async function MembershipPage({ searchParams }: { searchParams: { bought?: string } }) {
  const [m, settings] = await Promise.all([getMyMembership(), getSettings()]);
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'long' });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">Membership</h1>
      {searchParams.bought === '1' && !m && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
          Payment received — your pass activates as soon as the bank confirms. Refresh in a few seconds.
        </p>
      )}
      {m ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{m.plan_name ?? 'Membership'} · active</p>
              <p className="text-sm text-muted-foreground">Valid until {fmt(m.ends_at)}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-sm">
              <span>Wallpapers added</span>
              <span className="font-medium">
                {m.downloads_used} / {m.download_limit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (m.downloads_used / m.download_limit) * 100)}%` }} />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Open any premium wallpaper and press <strong>Add with membership</strong>. Wallpapers you add
            stay in your library forever{m.includes_commercial ? ' with a commercial licence' : ''}.
            Passes don&rsquo;t auto-renew — buy again any time to extend.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/explore" className={buttonVariants()}>
              Browse wallpapers
            </Link>
            {settings.membership_enabled && (
              <Link href="/pricing#membership" className={buttonVariants({ variant: 'outline' })}>
                Extend pass
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 text-sm">
          <p className="font-medium">You don&rsquo;t have an active pass.</p>
          <p className="mt-1 text-muted-foreground">
            {settings.membership_enabled
              ? 'A pass lets you add many wallpapers to your library for one price.'
              : 'Memberships aren’t on sale at the moment.'}
          </p>
          {settings.membership_enabled && (
            <Link href="/pricing#membership" className={buttonVariants({ className: 'mt-4' })}>
              See membership plans
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
