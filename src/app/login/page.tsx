import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Email OTP and Google sign-in are wired up with the checkout and library flows (after the
        payments gate). This is a placeholder.
      </p>
    </main>
  );
}
