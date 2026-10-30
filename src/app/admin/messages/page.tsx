import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { StatusSelect } from '@/components/admin/status-select';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage(props: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;
  const tab = searchParams.tab === 'takedowns' ? 'takedowns' : 'contact';
  const supabase = createServiceClient();
  const [{ data: messages }, { data: reports }] = await Promise.all([
    supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('takedown_reports').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  const openContact = (messages ?? []).filter((m) => m.status === 'new').length;
  const openReports = (reports ?? []).filter((r) => r.status === 'open' || r.status === 'reviewing').length;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">Messages</h1>
      <div className="flex gap-2 text-sm">
        <Link href="/admin/messages" className={`rounded-full border px-3 py-1 ${tab === 'contact' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
          Contact ({openContact} new)
        </Link>
        <Link href="/admin/messages?tab=takedowns" className={`rounded-full border px-3 py-1 ${tab === 'takedowns' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
          Takedown reports ({openReports} open)
        </Link>
      </div>

      {tab === 'contact' ? (
        (messages ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ul className="space-y-3">
            {(messages ?? []).map((m) => (
              <li key={m.id as string} className="rounded-2xl border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {m.name as string} · <a className="underline" href={`mailto:${m.email as string}?subject=${encodeURIComponent('Re: your message to HirecWallp')}`}>{m.email as string}</a>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {new Date(m.created_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    <StatusSelect url={`/api/admin/messages/${m.id}`} value={m.status as string} options={['new', 'replied', 'closed']} extra={{ kind: 'contact' }} />
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{m.message as string}</p>
              </li>
            ))}
          </ul>
        )
      ) : (reports ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No takedown reports.</p>
      ) : (
        <ul className="space-y-3">
          {(reports ?? []).map((r) => (
            <li key={r.id as string} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {(r.reporter_email as string) ?? 'anonymous'}
                  {r.url && (
                    <>
                      {' · '}
                      <a href={r.url as string} className="underline" target="_blank" rel="noopener noreferrer">
                        reported link
                      </a>
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {new Date(r.created_at as string).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  <StatusSelect url={`/api/admin/messages/${r.id}`} value={r.status as string} options={['open', 'reviewing', 'actioned', 'rejected']} extra={{ kind: 'takedown' }} />
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{r.details as string}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
