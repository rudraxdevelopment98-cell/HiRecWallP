import { requireUser } from '@/lib/auth';
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
  bonus: 'Bonus credits',
  expire: 'Bonus credits expired',
};

export default async function CreditsPage(props: { searchParams: Promise<{ bought?: string }> }) {
  await requireUser('/account/credits');
  const searchParams = await props.searchParams;
  const supabase = (await createClient());
  const [{ data: balance }, { data: ledger }, { data: bonusRows }] = await Promise.all([
    supabase.rpc('my_credit_balance'),
    supabase
      .from('credit_ledger')
      .select('id, delta, reason, bucket, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('credit_ledger').select('id, delta, lot_id, expires_at').eq('bucket', 'bonus'),
  ]);
  // Unexpired bonus lots and what's left in each (bonus is spent first).
  const used = new Map<string, number>();
  for (const r of bonusRows ?? []) if (r.lot_id) used.set(r.lot_id as string, (used.get(r.lot_id as string) ?? 0) + Number(r.delta));
  const lots = (bonusRows ?? [])
    .filter((r) => !r.lot_id && Number(r.delta) > 0 && r.expires_at && new Date(r.expires_at as string) > new Date())
    .map((r) => ({ id: r.id as string, left: Number(r.delta) + (used.get(r.id as string) ?? 0), expires: r.expires_at as string }))
    .filter((l) => l.left > 0)
    .sort((a, b) => a.expires.localeCompare(b.expires));
  const bonusLeft = lots.reduce((n, l) => n + l.left, 0);

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
            {bonusLeft > 0 && (
              <p className="text-xs text-muted-foreground">
                incl. {bonusLeft} bonus · next {lots[0]!.left} expire{lots[0]!.left === 1 ? 's' : ''}{' '}
                {new Date(lots[0]!.expires).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </p>
            )}
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
            No credit activity yet. 1 credit = 1 wallpaper in every size. Credits you pay for never expire; bonus credits last 12 months.
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {(ledger ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    {REASON[row.reason as string] ?? row.reason}
                    {row.bucket === 'bonus' && row.reason === 'spend' && <span className="ml-1 text-xs font-normal text-muted-foreground">(bonus)</span>}
                  </p>
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
