import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/http';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const next = safeNextPath(searchParams.next);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (configured && (await getUser())) redirect(next);

  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Sign in to buy wallpapers, spend credits and re-download from your library.
      </p>
      {searchParams.error && (
        <p className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          That sign-in link was invalid or expired. Please try again.
        </p>
      )}
      {configured ? (
        <div className="w-full rounded-2xl border bg-card p-6">
          <LoginForm next={next} />
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
