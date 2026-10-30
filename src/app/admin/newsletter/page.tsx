import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export default async function AdminNewsletterPage() {
  await requireAdmin();
  const { data, count } = await createServiceClient()
    .from('newsletter_subscribers')
    .select('email, source, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Newsletter</h1>
          <p className="text-sm text-muted-foreground">{count ?? 0} subscriber(s)</p>
        </div>
        <a href="/api/admin/newsletter" className="rounded-full border px-4 py-2 text-sm hover:bg-secondary">
          Download CSV
        </a>
      </div>
      {(data ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No sign-ups yet.</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card text-sm">
          {(data ?? []).map((r) => (
            <li key={r.email as string} className="flex items-center justify-between p-3">
              <span>{r.email as string}</span>
              <span className="text-xs text-muted-foreground">
                {(r.source as string) ?? 'site'} · {new Date(r.created_at as string).toLocaleDateString('en-IN')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
