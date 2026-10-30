import Link from 'next/link';
import type { Metadata } from 'next';
import { Coins } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { AutoRefresh } from '@/components/account/auto-refresh';

export const metadata: Metadata = { title: 'Credits' };

const REASON: Record<string, string> = {
  purchase: 'Credit pack purchased',
  spend: 'Wallpaper unlocked',
  refund: 'Refund',
  admin_adjust: 'Adjustment',
};

export default async function CreditsPage({ searchParams }: { searchParams: { bought?: string } }) {
  const supabase = createClient();
  const [{ data: balance }, { data: ledger }] = await Promise.all([
    supabase.rpc('my_credit_balance'),
    supabase
      .from('credit_ledger')
      .select('id, delta, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      {searchParams.bought === '1' && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
          Payment received — your credits appear here as soon as the bank confirms (usually a few seconds).
          <AutoRefresh />
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Credit balance</p>
            <p className="font-display text-3xl font-semibold">{Number(balance ?? 0)}</p>
          </div>
        </div>
        <Link href="/pricing" className={buttonVariants()}>
          Buy credits
        </Link>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">History</h2>
        {(ledger ?? []).length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No credit activity yet. Credits are used outside India; they never expire.
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {(ledger ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{REASON[row.reason as string] ?? row.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <span className={`font-semibold ${Number(row.delta) > 0 ? 'text-emerald-600' : ''}`}>
                  {Number(row.delta) > 0 ? '+' : ''}
                  {row.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
