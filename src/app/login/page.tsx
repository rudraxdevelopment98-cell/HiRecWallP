import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/http';
import { getSettings } from '@/lib/settings';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { REF_COOKIE } from '@/lib/growth';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage(
  props: {
    searchParams: Promise<{ next?: string; error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const next = safeNextPath(searchParams.next);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (configured && (await getUser())) redirect(next);
  const settings = await getSettings();
  const g = settings.growth;
  const referred = g.referral_enabled && Boolean((await cookies()).get(REF_COOKIE)?.value);
  const freeCredits = g.welcome_credits + (referred ? g.referee_bonus : 0);

  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Sign in to buy wallpapers, spend credits and re-download from your library.
      </p>
      {freeCredits > 0 && (
        <p className="w-full rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          New here? Your account starts with <strong>{freeCredits} free credits</strong>
          {referred ? ' (including your friend’s invite bonus)' : ''} — enough for {freeCredits} wallpapers. Valid {g.welcome_days} days.
        </p>
      )}
      {searchParams.error && (
        <p className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          That sign-in link was invalid or expired. Please try again.
        </p>
      )}
      {configured ? (
        <div className="w-full rounded-2xl border bg-card p-6">
          <LoginForm next={next} google={settings.google_login} />
          <p className="mt-4 text-xs text-muted-foreground">
            By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and{' '}
            <Link href="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      ) : (
        <p className="w-full rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Accounts are not connected on this preview yet. Sign-in turns on once Supabase Auth is
          configured. You can still browse, download free wallpapers and try the demo checkout.
        </p>
      )}
    </main>
  );
}
