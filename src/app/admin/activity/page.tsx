import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';
const PER_PAGE = 100;

const targetHref = (type: string | null, id: string | null) =>
  !id ? null : type === 'order' ? `/admin/orders/${id}` : type === 'user' ? `/admin/customers/${id}` : type === 'wallpaper' ? `/admin/catalogue/${id}` : null;

export default async function AdminActivityPage(props: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const q = (sp.q ?? '').trim();
  let query = createServiceClient()
    .from('admin_audit')
    .select('id, actor_email, action, target_type, target_id, details, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (q) query = query.ilike('action', `%${q.replace(/[%,]/g, ' ')}%`);
  const { data, count } = await query;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Activity log</h1>
          <p className="text-sm text-muted-foreground">Every change made in the admin panel: who, what and when.</p>
        </div>
        <form action="/admin/activity">
          <input name="q" defaultValue={q} placeholder="Filter by action (e.g. refund)" className="input h-8 w-56 py-1" aria-label="Filter actions" />
        </form>
      </div>
      {(data ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No admin activity recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="p-3">When</th>
                <th className="p-3">Who</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => {
                const href = targetHref(r.target_type as string | null, r.target_id as string | null);
                return (
                  <tr key={r.id as string} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap p-3">{new Date(r.created_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="p-3">{(r.actor_email as string) ?? 'system'}</td>
                    <td className="p-3 font-mono text-xs">
                      {href ? <Link href={href} className="underline">{r.action as string}</Link> : (r.action as string)}
                    </td>
                    <td className="max-w-md p-3 font-mono text-xs text-muted-foreground">
                      <span className="line-clamp-2 break-all">{r.details ? JSON.stringify(r.details) : '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))} basePath="/admin/activity" query={{ q }} />
    </div>
  );
}
