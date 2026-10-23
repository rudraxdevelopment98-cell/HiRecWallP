import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';

async function counts() {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const [published, drafts, orders] = await Promise.all([
      supabase.from('wallpapers').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('wallpapers').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
    ]);
    return {
      published: published.count ?? 0,
      drafts: drafts.count ?? 0,
      paidOrders: orders.count ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function AdminOverviewPage() {
  const stats = await counts();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Published" value={stats.published} />
          <Stat label="Drafts" value={stats.drafts} />
          <Stat label="Paid orders" value={stats.paidOrders} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Connect Supabase and R2 to see live stats. Use <strong>Upload</strong> to add a wallpaper,
          then publish it from <strong>Catalogue</strong>.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-6">
      <p className="text-3xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
