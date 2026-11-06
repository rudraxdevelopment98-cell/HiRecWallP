import Link from 'next/link';
import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';
import { SetPasswordForm } from '@/components/auth/set-password-form';

export const metadata: Metadata = { title: 'Set a new password', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Landing page of the password-reset email (the callback has already signed the person in). */
export default async function ResetPasswordPage() {
  const user = await getUser();
  return (
    <main className="container flex max-w-md flex-col gap-4 py-20">
      <h1 className="text-center font-display text-3xl font-semibold tracking-tight">Set a new password</h1>
      {user ? (
        <div className="rounded-2xl border bg-card p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            For <strong className="text-foreground">{user.email}</strong>. Other devices stay signed in — use “Sign out everywhere” in Settings if you think someone else had access.
          </p>
          <SetPasswordForm email={user.email ?? ''} after="/account?password=reset" label="Save new password" />
        </div>
      ) : (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          This reset link has expired or was already used.{' '}
          <Link href="/login?mode=forgot" className="underline">
            Request a new one
          </Link>
          .
        </p>
      )}
    </main>
  );
}
