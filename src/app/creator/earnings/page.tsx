import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCreator } from '@/lib/creator';
import { createClient } from '@/lib/supabase/server';
import { formatRegionPrice } from '@/lib/format';

export const metadata: Metadata = { title: 'Creator earnings' };

interface PayoutRow {
  period: string;
  gross: number;
  commission: number;
  net: number;
  currency: string;
  status: string;
}

export default async function CreatorEarningsPage() {
  const creator = await getCreator();
  if (!creator) redirect('/creator');

  const supabase = createClient();
  const { data } = await supabase
    .from('creator_payouts')
    .select('period, gross, commission, net, currency, status')
    .order('period', { ascending: false })
    .returns<PayoutRow[]>();
  const rows = data ?? [];

  const lifetimeNet = rows.reduce((s, r) => s + Number(r.net), 0);
  const lifetimeGross = rows.reduce((s, r) => s + Number(r.gross), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Earnings</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lifetime gross" value={formatRegionPrice(lifetimeGross, 'IN')} />
        <Stat label="Lifetime net" value={formatRegionPrice(lifetimeNet, 'IN')} />
        <Stat label="Commission" value={`${creator.commission_pct}%`} />
      </div>

      {rows.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          No earnings yet. Earnings are computed monthly from paid sales of your approved
          wallpapers. (Credit-based international sales are valued into payouts in a later update.)
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-2">Period</th>
              <th>Gross</th>
              <th>Commission</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period} className="border-b">
                <td className="py-2">{r.period}</td>
                <td>{formatRegionPrice(Number(r.gross), 'IN')}</td>
                <td>{formatRegionPrice(Number(r.commission), 'IN')}</td>
                <td>{formatRegionPrice(Number(r.net), 'IN')}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
