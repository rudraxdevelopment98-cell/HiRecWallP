import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/account/profile-form';
import { ChangeEmailForm, CloseAccountForm, SignOutEverywhere } from '@/components/account/account-controls';
import { closeBlocker, getAccountSummary } from '@/lib/account';

export const metadata: Metadata = { title: 'Account settings' };

export default async function AccountPage() {
  const user = await requireUser('/account');
  const { data: profile } = await (await createClient())
    .from('profiles')
    .select('display_name, country_code, gstin, role, created_at')
    .eq('id', user.id)
    .maybeSingle();
  const summary = await getAccountSummary(user.id).catch(() => null);
  const credits = summary ? Math.max(0, summary.paid_credits) + summary.bonus_credits : 0;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email ?? user.id}</span>
          {profile?.role === 'admin' && (
            <>
              {' · '}
              <Link href="/admin" className="underline">
                Admin panel
              </Link>
            </>
          )}
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ProfileForm
          initial={{
            display_name: profile?.display_name ?? null,
            country_code: profile?.country_code ?? null,
            gstin: profile?.gstin ?? null,
          }}
        />
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="font-semibold">Email &amp; sign-in</h2>
          <p className="text-sm text-muted-foreground">We sign you in with a one-time code sent to your email — there’s no password to leak.</p>
        </div>
        <ChangeEmailForm current={user.email ?? ''} />
        <div className="border-t pt-4">
          <p className="mb-2 text-sm text-muted-foreground">Lost a phone or used a shared computer? End every session at once.</p>
          <SignOutEverywhere />
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-6 text-sm">
        <h2 className="font-semibold">Your data</h2>
        <p className="text-muted-foreground">
          Download everything we hold about you — profile, orders, credits, library, downloads, support requests and consents — as one file.
          See the <Link href="/privacy" className="underline">Privacy Policy</Link> for your rights.
        </p>
        <a href="/api/account/export" className="inline-block font-medium underline">
          Download my data (JSON)
        </a>
      </section>

      <section className="rounded-2xl border bg-card p-6 text-sm">
        <h2 className="font-semibold">Sell your own wallpapers</h2>
        <p className="mt-1 text-muted-foreground">
          Join as a creator: upload your work, we handle checks, sales and monthly payouts.
        </p>
        <Link href="/creator" className="mt-3 inline-block underline">
          Become a creator →
        </Link>
      </section>

      <section className="space-y-3 rounded-2xl border border-rose-200 bg-card p-6 text-sm">
        <h2 className="font-semibold text-rose-700">Close account</h2>
        <p className="text-muted-foreground">Closing your account removes your personal details straight away. Before you go, please note:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Your <strong>{credits} remaining credit{credits === 1 ? '' : 's'}</strong> are forfeited.
            {summary && summary.paid_credits > 0 && <> Unused packs bought in the last 14 days can be <Link href="/account/orders" className="underline">refunded first</Link>.</>}
          </li>
          <li>Your library ({summary?.library ?? 0} wallpaper{summary?.library === 1 ? '' : 's'}) and any active pass{summary?.active_passes ? ` (${summary.active_passes})` : ''} end — download what you want to keep first.</li>
          {summary && summary.autopay > 0 && <li>Autopay is cancelled; no further charges.</li>}
          <li>Order and invoice records are kept for 8 years because tax law requires it, without your name or email.</li>
          <li>You can sign up again later with the same email as a new customer.</li>
        </ul>
        <CloseAccountForm email={user.email ?? ''} blocked={summary ? closeBlocker(summary) : 'Account details couldn’t be loaded — please try again later.'} />
      </section>
    </div>
  );
}
