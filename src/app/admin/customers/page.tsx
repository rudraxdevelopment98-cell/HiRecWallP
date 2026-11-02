import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';
const PER_PAGE = 50;

interface Row {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  country_code: string | null;
  gstin: string | null;
  created_at: string;
  paid_orders: number;
  owned: number;
  total_count: number;
}

export default async function AdminCustomersPage(props: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const { data } = await createServiceClient().rpc('admin_customers', { p_q: q, p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE });
  const rows = (data ?? []) as Row[];
  const total = Number(rows[0]?.total_count ?? 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Customers</h1>
        <form action="/admin/customers">
          <input name="q" defaultValue={q} placeholder="Search email or name…" className="input h-8 w-64 py-1" aria-label="Search customers" />
        </form>
      </div>
      <p className="text-sm text-muted-foreground">{total.toLocaleString('en-IN')} account(s)</p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="p-3">Customer</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Paid orders</th>
              <th className="p-3">Wallpapers owned</th>
              <th className="p-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-secondary/50">
                <td className="p-3">
                  <Link href={`/admin/customers/${u.id}`} className="font-medium hover:underline">
                    {u.email ?? u.id.slice(0, 8)}
                  </Link>
                  {u.display_name && <span className="text-muted-foreground"> · {u.display_name}</span>}
                  {u.gstin && <span className="block text-xs text-muted-foreground">GSTIN {u.gstin}</span>}
                </td>
                <td className="whitespace-nowrap p-3">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                <td className="p-3 tabular-nums">{u.paid_orders}</td>
                <td className="p-3 tabular-nums">{u.owned}</td>
                <td className="p-3">
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PER_PAGE))} basePath="/admin/customers" query={{ q }} />
    </div>
  );
}
