'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Coins, Download, LifeBuoy, LogIn, Mail, Receipt, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';
import type { TimelineEvent, TimelineKind } from '@/lib/timeline';

const ICON: Record<TimelineKind, typeof Receipt> = { order: Receipt, credit: Coins, ticket: LifeBuoy, download: Download, signin: LogIn, staff: UserCog, email: Mail };
const FILTERS: { key: 'all' | TimelineKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'order', label: 'Orders' },
  { key: 'credit', label: 'Credits' },
  { key: 'download', label: 'Downloads' },
  { key: 'ticket', label: 'Support' },
  { key: 'signin', label: 'Sign-ins' },
  { key: 'staff', label: 'Staff' },
  { key: 'email', label: 'Emails' },
];

export function CustomerTimeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<'all' | TimelineKind>('all');
  const shown = events.filter((e) => filter === 'all' || e.kind === filter);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.filter((f) => f.key === 'all' || events.some((e) => e.kind === f.key)).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === f.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ol className="relative space-y-3 border-l pl-5">
          {shown.map((e, i) => {
            const Icon = ICON[e.kind];
            return (
              <li key={i} className="relative text-sm">
                <span className="absolute -left-[29px] top-0.5 grid h-5 w-5 place-items-center rounded-full border bg-card">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                </span>
                <p>{e.href ? <Link href={e.href} className="hover:underline">{e.title}</Link> : e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                  {e.detail && ` · ${e.detail}`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function EmailCustomerForm({ userId, email }: { userId: string; email: string | null }) {
  const { refresh, refreshing } = useRefresh();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!email) return <p className="text-sm text-muted-foreground">This account has no email address.</p>;
  return (
    <form
      className="space-y-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const res = await fetch(`/api/admin/customers/${userId}/email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, message }) }).catch(() => null);
        setBusy(false);
        if (res?.ok) {
          setMsg({ ok: true, text: `Sent to ${email}.` });
          setSubject('');
          setMessage('');
        } else setMsg({ ok: false, text: ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not send' });
        refresh();
      }}
    >
      <input className="input" required minLength={3} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" />
      <textarea className="input min-h-28" required minLength={5} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Message to ${email}`} aria-label="Message" />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy || refreshing}>
          {busy ? 'Sending…' : 'Send email'}
        </Button>
        <span className="text-xs text-muted-foreground">Sent from the store address; it appears on the timeline.</span>
      </div>
      {msg && <p className={msg.ok ? 'text-emerald-700' : 'text-rose-700'}>{msg.text}</p>}
    </form>
  );
}
