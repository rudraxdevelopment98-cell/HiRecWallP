import type { Metadata } from 'next';
import { Gift } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { RedeemForm } from '@/components/gift/redeem-form';

export const metadata: Metadata = { title: 'Redeem a gift' };
export const dynamic = 'force-dynamic';

export default async function GiftPage() {
  const user = await getUser();
  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <Gift className="h-10 w-10" />
      <h1 className="font-display text-3xl font-semibold tracking-tight">Redeem a gift</h1>
      <p className="text-sm text-muted-foreground">Enter the 12-character code from your gift email or message.</p>
      <div className="w-full rounded-2xl border bg-card p-6 text-left">
        <RedeemForm signedIn={Boolean(user)} />
      </div>
    </main>
  );
}
