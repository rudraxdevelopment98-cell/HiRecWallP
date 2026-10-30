import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { listAuthUsers } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage(props: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const supabase = createServiceClient();
  const [users, { data: profiles }, { data: orders }, { data: ents }] = await Promise.all([
    listAuthUsers().catch(() => []),
    supabase.from('profiles').select('id, display_name, role, country_code, gstin'),
    supabase.from('orders').select('user_id').eq('status', 'paid'),
    supabase.from('entitlements').select('user_id'),
  ]);
  const profile = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const count = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const paid = count(orders as { user_id: string }[] | null);
  const owned = count(ents as { user_id: string }[] | null);
  const q = searchParams.q?.toLowerCase().trim();
  const rows = users
    .filter((u) => !q || u.email?.toLowerCase().includes(q))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Customers</h1>
        <form action="/admin/customers">
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search email…" className="input h-8 w-56 py-1" />
        </form>
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} account(s)</p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="p-3">Email</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Last sign-in</th>
              <th className="p-3">Paid orders</th>
              <th className="p-3">Wallpapers owned</th>
              <th className="p-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const p = profile.get(u.id);
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-3">
                    {u.email}
                    {p?.display_name && <span className="text-muted-foreground"> · {p.display_name as string}</span>}
                    {p?.gstin && <span className="block text-xs text-muted-foreground">GSTIN {p.gstin as string}</span>}
                  </td>
                  <td className="whitespace-nowrap p-3">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="whitespace-nowrap p-3">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="p-3">{paid.get(u.id) ?? 0}</td>
                  <td className="p-3">{owned.get(u.id) ?? 0}</td>
                  <td className="p-3">
                    <Badge variant={p?.role === 'admin' ? 'default' : 'secondary'}>{(p?.role as string) ?? 'buyer'}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
