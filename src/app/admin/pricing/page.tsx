import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { PricingRunner } from '@/components/admin/pricing-runner';

interface HistoryRow {
  id: string;
  wallpaper_id: string;
  region_code: string;
  old_price: number | null;
  new_price: number;
  reason: string | null;
  created_at: string;
}

async function recentHistory(): Promise<HistoryRow[] | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('price_history')
      .select('id, wallpaper_id, region_code, old_price, new_price, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(25);
    return (data as HistoryRow[]) ?? [];
  } catch {
    return null;
  }
}

export default async function AdminPricingPage() {
  await requireAdmin();
  const history = await recentHistory();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dynamic pricing</h1>
        <p className="text-sm text-muted-foreground">
          Nightly job (02:00 UTC). Simulate to preview the diff; apply to write prices + history.
          Rules, freeze and overrides are configured per region/category/wallpaper in price_rules.
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <PricingRunner />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent price history</h2>
        {history == null ? (
          <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">Connect Supabase to see history.</p>
        ) : history.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">No price changes recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2">When</th>
                <th>Region</th>
                <th>Old → New</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="py-2">{new Date(h.created_at).toLocaleString()}</td>
                  <td>{h.region_code}</td>
                  <td>
                    {h.old_price ?? '—'} → {h.new_price}
                  </td>
                  <td className="text-muted-foreground">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
