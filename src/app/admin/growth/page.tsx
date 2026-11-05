import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';
import { formatMoneyMinor } from '@/lib/format';
import { istToday } from '@/lib/daily';
import { RunJobButton } from '@/components/admin/run-job-button';
import { wallpaperPath } from '@/lib/wallpaper-url';

export const dynamic = 'force-dynamic';

export default async function AdminGrowthPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const today = istToday();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [settings, welcome, referrals, rewarded, giftsSent, giftsRedeemed, dailySubs, dailyClaims, pick, comms] = await Promise.all([
    getSettings(),
    count(supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('welcome_bonus_at', since)),
    count(supabase.from('referral_rewards').select('id', { count: 'exact', head: true }).gte('created_at', since)),
    count(supabase.from('referral_rewards').select('id', { count: 'exact', head: true }).eq('status', 'rewarded').gte('rewarded_at', since)),
    count(supabase.from('gift_codes').select('id', { count: 'exact', head: true }).gte('created_at', since)),
    count(supabase.from('gift_codes').select('id', { count: 'exact', head: true }).eq('status', 'redeemed').gte('redeemed_at', since)),
    count(supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('daily', true)),
    count(supabase.from('entitlements').select('id', { count: 'exact', head: true }).eq('source', 'daily').gte('created_at', `${today}T00:00:00+05:30`)),
    supabase.from('daily_picks').select('day, emailed_at, wallpapers(title, slug, code)').eq('day', today).maybeSingle(),
    supabase.from('affiliate_commissions').select('currency, commission_minor, status').gte('created_at', since),
  ]);
  const g = settings.growth;
  const affiliate = new Map<string, number>();
  for (const c of (comms.data ?? []) as { currency: string; commission_minor: number; status: string }[]) {
    if (c.status !== 'void') affiliate.set(c.currency, (affiliate.get(c.currency) ?? 0) + c.commission_minor);
  }
  const p = pick.data as unknown as { emailed_at: string | null; wallpapers: { title: string; slug: string } | null } | null;

  const tiles: [string, string, string][] = [
    ['Welcome bonuses', String(welcome), `${g.welcome_credits} credits each`],
    ['Friends invited', String(referrals), `${rewarded} bought → inviter got ${g.referrer_reward}`],
    ['Gifts sent', String(giftsSent), `${giftsRedeemed} redeemed`],
    ['Daily pick claims today', String(dailyClaims), `${dailySubs} email subscribers`],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Growth</h1>
        <p className="text-sm text-muted-foreground">
          Last 30 days. Change every number in <Link href="/admin/settings?tab=growth" className="underline">Settings → Growth</Link>; festival dates are on each
          pack or plan in <Link href="/admin/credit-packs" className="underline">Credit packs</Link> / <Link href="/admin/membership" className="underline">Membership</Link>.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="admin-card p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="admin-card p-6 text-sm">
          <h2 className="font-semibold">Daily free wallpaper</h2>
          {p?.wallpapers ? (
            <p className="mt-2">
              Today: <Link href={wallpaperPath(p.wallpapers)} className="underline">{p.wallpapers.title}</Link>
              {p.emailed_at ? ' · email sent' : process.env.RESEND_API_KEY ? ' · email goes out with the nightly job' : ' · email off (RESEND_API_KEY not set)'}
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">No pick yet today — it is chosen at 00:05 IST, or on the first visit of the day.</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {g.daily_enabled ? 'On' : 'Off'} · up to {g.daily_email_cap} emails a day · subscribers opt in from the newsletter box and can unsubscribe in one click.
          </p>
          <div className="mt-3">
            <RunJobButton label="Run daily pick now" endpoint="/api/jobs/daily-pick" />
          </div>
        </div>
        <div className="admin-card p-6 text-sm">
          <h2 className="font-semibold">Creator affiliate commissions</h2>
          {affiliate.size === 0 ? (
            <p className="mt-2 text-muted-foreground">None yet. Creators share links with <code>?via=CODE</code> from their dashboard.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {[...affiliate.entries()].map(([cur, v]) => (
                <li key={cur}>{formatMoneyMinor(v, cur)} owed or paid ({cur})</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {g.affiliate_enabled ? `${g.affiliate_pct}% of each referred order` : 'Off'} · paid with monthly creator payouts (foreign currencies at your rates in Settings).
          </p>
        </div>
      </section>
    </div>
  );
}
