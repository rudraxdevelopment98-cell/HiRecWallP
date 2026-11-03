import type { Metadata } from 'next';
import { Gift, Share2 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getMyReferral } from '@/lib/growth';
import { getSettings } from '@/lib/settings';
import { publicEnv } from '@/lib/env';
import { CopyField } from '@/components/account/copy-field';

export const metadata: Metadata = { title: 'Invite friends' };

export default async function ReferralsPage() {
  const user = await requireUser('/account/referrals');
  const [ref, settings] = await Promise.all([getMyReferral(user.id), getSettings()]);
  const g = settings.growth;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

  if (!g.referral_enabled || !ref) {
    return (
      <div className="max-w-2xl rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        Invites aren&rsquo;t available right now. Check back soon.
      </div>
    );
  }
  const link = `${site}/r/${ref.code}`;
  const message = `Get ${g.welcome_credits + g.referee_bonus} free wallpaper credits on ${publicEnv.NEXT_PUBLIC_BRAND_NAME} with my link: ${link}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Invite friends</h1>
        <p className="text-sm text-muted-foreground">
          Your friend gets <strong>{g.welcome_credits + g.referee_bonus} free credits</strong> when they sign up with your link. You get{' '}
          <strong>{g.referrer_reward} credits</strong> when they make their first purchase.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-6">
        <p className="flex items-center gap-2 font-semibold">
          <Share2 className="h-4 w-4" /> Your link
        </p>
        <CopyField value={link} label="Referral link" />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Code</span>
          <span className="rounded-md border px-2 py-1 font-mono font-semibold tracking-wider">{ref.code}</span>
          <a className="underline" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            Share on WhatsApp
          </a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Friends joined', ref.invited],
          ['Made a purchase', ref.rewarded],
          ['Credits earned', ref.creditsEarned],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-6 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Gift className="h-4 w-4" /> How it works
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Your friend signs up with your link within 30 days and gets {g.welcome_credits + g.referee_bonus} credits (valid {g.welcome_days} days).</li>
          <li>When they make their first purchase, you get {g.referrer_reward} bonus credits (valid {Math.round(g.reward_days / 30)} months).</li>
          <li>Up to {g.referral_monthly_cap} rewards a month. Rewards for purchases that are refunded are taken back.</li>
          <li>One welcome bonus per person. Accounts created to collect bonuses are removed.</li>
        </ul>
        {ref.pending > 0 && <p className="mt-3">{ref.pending} friend{ref.pending === 1 ? ' has' : 's have'} joined and not bought yet.</p>}
      </section>
    </div>
  );
}
