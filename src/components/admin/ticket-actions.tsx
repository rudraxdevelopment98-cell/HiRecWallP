'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';
import { cn } from '@/lib/utils';

type Status = 'open' | 'waiting_customer' | 'resolved' | 'closed';

async function act(ticketId: string, payload: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/admin/support/${ticketId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);
  if (res?.ok) return null;
  const data = (await res?.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? 'Action failed';
}

/** Reply / internal note composer with "status after sending". */
export function TicketComposer({ ticketId, status }: { ticketId: string; status: Status }) {
  const { refresh, refreshing } = useRefresh();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [after, setAfter] = useState<Status>('waiting_customer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const err = await act(ticketId, { action: 'reply', body, internal, status: internal ? undefined : after });
        setBusy(false);
        if (err) setError(err);
        else {
          setBody('');
          refresh();
        }
      }}
    >
      <div className="flex gap-1 rounded-lg border bg-secondary/40 p-1 text-sm" role="tablist">
        {[
          { v: false, label: 'Reply to customer' },
          { v: true, label: 'Internal note' },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={internal === t.v}
            onClick={() => setInternal(t.v)}
            className={cn('flex-1 rounded-md px-3 py-1.5', internal === t.v ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        className={cn('input min-h-32', internal && 'border-amber-300 bg-amber-50/60')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        required
        placeholder={internal ? 'Only staff can see this.' : 'The customer gets this by email and in their account.'}
        aria-label={internal ? 'Internal note' : 'Reply'}
      />
      <div className="flex flex-wrap items-center gap-3">
        {!internal && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Then mark as</span>
            <select className="input h-9 w-auto py-1" value={after} onChange={(e) => setAfter(e.target.value as Status)}>
              <option value="waiting_customer">Waiting on customer</option>
              <option value="open">Still open</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        )}
        <Button type="submit" size="sm" className="ml-auto" disabled={busy || refreshing || !body.trim()}>
          {busy || refreshing ? 'Sending…' : internal ? 'Save note' : 'Send reply'}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      {status === 'closed' && <p className="text-xs text-muted-foreground">This ticket is closed; replying reopens it with the status you choose.</p>}
    </form>
  );
}

/** One-click admin action with optional confirmation and inputs. */
export function TicketAction({
  ticketId,
  label,
  payload,
  confirm,
  variant = 'outline',
  fields,
}: {
  ticketId: string;
  label: string;
  payload: Record<string, unknown>;
  confirm?: string;
  variant?: 'outline' | 'default' | 'secondary';
  fields?: { name: string; label: string; type?: 'text' | 'number'; placeholder?: string; required?: boolean }[];
}) {
  const { refresh, refreshing } = useRefresh();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const run = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError('');
    const extra = Object.fromEntries((fields ?? []).map((f) => [f.name, f.type === 'number' ? Number(values[f.name] ?? 0) : (values[f.name] ?? '').trim() || undefined]));
    const err = await act(ticketId, { ...payload, ...extra });
    setBusy(false);
    if (err) setError(err);
    else {
      setOpen(false);
      setValues({});
      refresh();
    }
  };

  if (fields?.length && !open) {
    return (
      <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div className={cn(fields?.length && 'w-full space-y-2 rounded-lg border p-3')}>
      {fields?.map((f) => (
        <label key={f.name} className="block space-y-1 text-xs">
          <span className="text-muted-foreground">{f.label}</span>
          <input
            className="input h-9 py-1"
            type={f.type ?? 'text'}
            placeholder={f.placeholder}
            value={values[f.name] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={variant}
          disabled={busy || refreshing || Boolean(fields?.some((f) => f.required && !(values[f.name] ?? '').trim()))}
          onClick={run}
        >
          {busy || refreshing ? 'Working…' : label}
        </Button>
        {fields?.length ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error && (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
