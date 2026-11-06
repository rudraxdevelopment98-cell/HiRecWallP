import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/admin/ui';
import { createServiceClient } from '@/lib/supabase/service';
import { emailsFor } from '@/lib/admin';
import { formatMoneyMinor } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { StatusSelect } from '@/components/admin/status-select';
import { RunJobButton } from '@/components/admin/run-job-button';

export const dynamic = 'force-dynamic';

export default async function AdminCreatorsPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const [{ data: creators }, { data: payouts }, { data: subs }] = await Promise.all([
    supabase.from('creators').select('*').order('created_at', { ascending: false }),
    supabase.from('creator_payouts').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('wallpapers').select('creator_id, status').not('creator_id', 'is', null),
  ]);
  const email = await emailsFor([
    ...((creators ?? []) as { user_id: string }[]).map((c) => c.user_id),
    ...((payouts ?? []) as { creator_id: string }[]).map((p) => p.creator_id),
  ]);
  const counts = new Map<string, { total: number; published: number }>();
  for (const s of subs ?? []) {
    const c = counts.get(s.creator_id as string) ?? { total: 0, published: 0 };
    c.total += 1;
    if (s.status === 'published') c.published += 1;
    counts.set(s.creator_id as string, c);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Creators"
        description="Verify KYC, set commission and run payouts. Payouts run automatically on the 1st of each month."
        actions={<RunJobButton label="Run monthly payouts" variant="outline" endpoint="/api/jobs/creator-payouts" />}
      />

      {(creators ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No creators have joined yet.</p>
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Joined</th>
                <th>Uploads</th>
                <th>Payout via</th>
                <th>Platform fee</th>
                <th>KYC</th>
              </tr>
            </thead>
            <tbody>
              {(creators ?? []).map((c) => {
                const n = counts.get(c.user_id as string) ?? { total: 0, published: 0 };
                return (
                  <tr key={c.user_id as string}>
                    <td >
                      {(c.display_name as string) ?? '—'}
                      <span className="block text-xs text-muted-foreground">{email.get(c.user_id as string)}</span>
                    </td>
                    <td className="whitespace-nowrap">{new Date(c.created_at as string).toLocaleDateString('en-IN')}</td>
                    <td >
                      {n.published} live / {n.total}
                    </td>
                    <td >{(c.payout_provider as string)?.replace('_', ' ') ?? '—'}</td>
                    <td >{Number(c.commission_pct)}%</td>
                    <td >
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
          <ul className="divide-y admin-card text-sm">
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
