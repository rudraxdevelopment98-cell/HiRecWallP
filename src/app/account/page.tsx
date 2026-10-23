import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <main className="container max-w-xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <div className="rounded-lg border p-4 text-sm">
        <p className="text-muted-foreground">Signed in as</p>
        <p className="font-medium">{user.email ?? user.id}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Orders, receipts and GST details (for Indian buyers) are managed here. Full account settings
        land alongside the auth flow.
      </p>
    </main>
  );
}
