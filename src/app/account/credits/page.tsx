import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Coins } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { AutoRefresh } from '@/components/account/auto-refresh';
import { wallpaperPath } from '@/lib/wallpaper-url';

export const metadata: Metadata = { title: 'Credits' };

const REASON: Record<string, string> = {
  purchase: 'Credit pack purchased',
  spend: 'Wallpaper unlocked',
  refund: 'Refund',
  admin_adjust: 'Adjustment',
  bonus: 'Bonus credits',
  welcome: 'Welcome bonus',
  referral: 'Referral reward',
  expire: 'Bonus credits expired',
  closure: 'Forfeited (account closed)',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'added', label: 'Added' },
  { key: 'spent', label: 'Spent' },
  { key: 'bonus', label: 'Bonus' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];
const PER_PAGE = 25;

export default async function CreditsPage(props: { searchParams: Promise<{ bought?: string; f?: string; page?: string }> }) {
  await requireUser('/account/credits');
  const searchParams = await props.searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === searchParams.f) ? (searchParams.f as Filter) : 'all';
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1);
  const supabase = (await createClient());
  let history = supabase
    .from('credit_ledger')
    .select('id, delta, reason, bucket, ref_id, expires_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (filter === 'added') history = history.gt('delta', 0);
  if (filter === 'spent') history = history.eq('reason', 'spend');
  if (filter === 'bonus') history = history.eq('bucket', 'bonus');
  const [{ data: balance }, { data: ledger, count }, { data: bonusRows }] = await Promise.all([
    supabase.rpc('my_credit_balance'),
    history,
    supabase.from('credit_ledger').select('id, delta, lot_id, expires_at').eq('bucket', 'bonus'),
  ]);
  // Spends point at the entitlement: show which wallpaper they unlocked.
  const spendRefs = (ledger ?? []).filter((r) => r.reason === 'spend' && r.ref_id).map((r) => r.ref_id as string);
  const { data: ents } = spendRefs.length
    ? await supabase.from('entitlements').select('id, wallpapers(title, slug, code)').in('id', [...new Set(spendRefs)])
    : { data: [] };
  const unlocked = new Map((ents ?? []).map((e) => [e.id as string, e.wallpapers as unknown as { title: string; slug: string; code: string | null } | null]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const ORDER_REASONS = new Set(['purchase', 'bonus', 'refund']);
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

      {lots.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Bonus credits expiring</h2>
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {lots.map((l) => {
              const days = Math.ceil((new Date(l.expires).getTime() - Date.now()) / 86_400_000);
              return (
                <li key={l.id} className="flex items-center justify-between p-4">
                  <span>
                    {l.left} bonus credit{l.left === 1 ? '' : 's'}
                    <span className={`ml-2 text-xs ${days <= 14 ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}>
                      expire {new Date(l.expires).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      {days <= 14 && ` (in ${days} day${days === 1 ? '' : 's'})`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Bonus credits are used first, soonest-expiring first. Credits you paid for never expire.</p>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">History</h2>
          <nav className="flex gap-1 rounded-lg border bg-card p-1 text-sm" aria-label="Filter history">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === 'all' ? '/account/credits' : `/account/credits?f=${f.key}`}
                aria-current={filter === f.key ? 'page' : undefined}
                className={`rounded-md px-3 py-1 ${filter === f.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        {(ledger ?? []).length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {filter === 'all'
              ? 'No credit activity yet. 1 credit = 1 wallpaper in every size. Credits you pay for never expire; bonus credits last 12 months.'
              : 'Nothing here for this filter.'}
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {(ledger ?? []).map((row) => {
              const w = row.reason === 'spend' && row.ref_id ? unlocked.get(row.ref_id as string) : null;
              const orderLink = ORDER_REASONS.has(row.reason as string) && row.ref_id && Number(row.delta) > 0;
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {REASON[row.reason as string] ?? row.reason}
                      {row.bucket === 'bonus' && row.reason === 'spend' && <span className="ml-1 text-xs font-normal text-muted-foreground">(bonus)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(row.created_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      {w && (
                        <>
                          {' · '}
                          <Link href={wallpaperPath(w)} className="underline">{w.title}</Link>
                        </>
                      )}
                      {orderLink && (
                        <>
                          {' · '}
                          <Link href={`/account/orders/${row.ref_id}`} className="underline">receipt</Link>
                        </>
                      )}
                      {row.bucket === 'bonus' && Number(row.delta) > 0 && row.expires_at && (
                        <> · expires {new Date(row.expires_at as string).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 font-semibold tabular-nums ${Number(row.delta) > 0 ? 'text-emerald-600' : ''}`}>
                    {Number(row.delta) > 0 ? '+' : ''}
                    {row.delta}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={`/account/credits?${new URLSearchParams({ ...(filter !== 'all' ? { f: filter } : {}), page: String(page - 1) })}`} className="underline">← Newer</Link> : <span />}
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            {page < totalPages ? <Link href={`/account/credits?${new URLSearchParams({ ...(filter !== 'all' ? { f: filter } : {}), page: String(page + 1) })}`} className="underline">Older →</Link> : <span />}
          </div>
        )}
      </section>
    </div>
  );
}
