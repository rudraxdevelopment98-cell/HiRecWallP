'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';

/** Customer reply on their own request. */
export function ReplyBox({ ticketId, resolved }: { ticketId: string; resolved: boolean }) {
  const { refresh, refreshing } = useRefresh();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body }),
        }).catch(() => null);
        const data = (await res?.json().catch(() => null)) as { error?: string } | null;
        setBusy(false);
        if (res?.ok) {
          setBody('');
          refresh();
        } else setError(data?.error ?? 'Could not send. Please try again.');
      }}
    >
      <label htmlFor="reply" className="block text-sm font-medium">
        {resolved ? 'Still not right? Reply to reopen this request' : 'Add a message'}
      </label>
      <textarea id="reply" className="input min-h-28" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required />
      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || refreshing || !body.trim()}>
        {busy || refreshing ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
}
