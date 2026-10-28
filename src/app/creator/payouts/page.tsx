import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCreator } from '@/lib/creator';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { formatRegionPrice } from '@/lib/format';

export const metadata: Metadata = { title: 'Creator payouts' };

interface PayoutRow {
  id: string;
  period: string;
  net: number;
  currency: string;
  status: string;
  provider_ref: string | null;
  created_at: string;
}

function variant(status: string): 'free' | 'secondary' | 'outline' {
  if (status === 'paid') return 'free';
  if (status === 'failed') return 'outline';
  return 'secondary';
}

export default async function CreatorPayoutsPage() {
  const creator = await getCreator();
  if (!creator) redirect('/creator');

  const supabase = createClient();
  const { data } = await supabase
    .from('creator_payouts')
    .select('id, period, net, currency, status, provider_ref, created_at')
    .order('period', { ascending: false })
    .returns<PayoutRow[]>();
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Payouts</h1>

      <div className="glass rounded-2xl p-5 text-sm">
        <p className="font-medium">Payout setup</p>
        <p className="text-muted-foreground">
          Method: {creator.payout_provider ?? '—'} · Account: {creator.payout_account_id ?? '—'} ·
          KYC: <Badge variant={creator.kyc_status === 'verified' ? 'free' : 'secondary'}>{creator.kyc_status}</Badge>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Payouts run monthly (1st, 06:00 UTC) for the previous month once KYC is verified.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">No payouts yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-2">Period</th>
              <th>Net</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{r.period}</td>
                <td>{formatRegionPrice(Number(r.net), 'IN')}</td>
                <td>
                  <Badge variant={variant(r.status)}>{r.status}</Badge>
                </td>
                <td className="text-xs text-muted-foreground">{r.provider_ref ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
