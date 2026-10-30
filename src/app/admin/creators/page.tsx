import { createServiceClient } from '@/lib/supabase/service';
import { listAuthUsers } from '@/lib/admin';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { StatusSelect } from '@/components/admin/status-select';
import { RunJobButton } from '@/components/admin/run-job-button';

export const dynamic = 'force-dynamic';

export default async function AdminCreatorsPage() {
  const supabase = createServiceClient();
  const [{ data: creators }, { data: payouts }, { data: subs }, users] = await Promise.all([
    supabase.from('creators').select('*').order('created_at', { ascending: false }),
    supabase.from('creator_payouts').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('wallpapers').select('creator_id, status').not('creator_id', 'is', null),
    listAuthUsers().catch(() => []),
  ]);
  const email = new Map(users.map((u) => [u.id, u.email]));
  const counts = new Map<string, { total: number; published: number }>();
  for (const s of subs ?? []) {
    const c = counts.get(s.creator_id as string) ?? { total: 0, published: 0 };
    c.total += 1;
    if (s.status === 'published') c.published += 1;
    counts.set(s.creator_id as string, c);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Creators</h1>
        <RunJobButton label="Run monthly payouts" variant="outline" endpoint="/api/jobs/creator-payouts" />
      </div>

      {(creators ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No creators have joined yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="p-3">Creator</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Uploads</th>
                <th className="p-3">Payout via</th>
                <th className="p-3">Commission</th>
                <th className="p-3">KYC</th>
              </tr>
            </thead>
            <tbody>
              {(creators ?? []).map((c) => {
                const n = counts.get(c.user_id as string) ?? { total: 0, published: 0 };
                return (
                  <tr key={c.user_id as string} className="border-b last:border-0">
                    <td className="p-3">
                      {(c.display_name as string) ?? '—'}
                      <span className="block text-xs text-muted-foreground">{email.get(c.user_id as string)}</span>
                    </td>
                    <td className="whitespace-nowrap p-3">{new Date(c.created_at as string).toLocaleDateString('en-IN')}</td>
                    <td className="p-3">
                      {n.published} live / {n.total}
                    </td>
                    <td className="p-3">{(c.payout_provider as string)?.replace('_', ' ') ?? '—'}</td>
                    <td className="p-3">{Number(c.commission_pct)}%</td>
                    <td className="p-3">
                      <StatusSelect
                        url={`/api/admin/creators/${c.user_id}`}
                        field="kyc_status"
                        value={c.kyc_status as string}
                        options={['none', 'pending', 'verified', 'rejected']}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Recent payouts</h2>
        {(payouts ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts yet.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {(payouts ?? []).map((p) => (
              <li key={p.id as string} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {email.get(p.creator_id as string) ?? (p.creator_id as string).slice(0, 8)} · {p.period as string}
                </span>
                <span className="flex items-center gap-2">
                  {formatMoneyMinor(Math.round(Number(p.net) * 100), p.currency as string)} net
                  <Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>{p.status as string}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
