import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/account');

  return (
    <main className="container max-w-xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <div className="rounded-lg border p-4 text-sm">
        <p className="text-muted-foreground">Signed in as</p>
        <p className="font-medium">{user.email ?? user.id}</p>
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded-lg border px-4 py-2 text-sm hover:bg-secondary">
          Sign out
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Your purchases and credit balance live in <a href="/library" className="underline">My
        Library</a>. Receipts and GST details (for Indian buyers) will be added here.
      </p>
    </main>
  );
}
