'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';

/** One-click autopay cancel (with a single confirm). The paid month keeps running. */
export function CancelAutopayButton({ subscriptionId, until }: { subscriptionId: string; until: string | null }) {
  const { refresh, refreshing } = useRefresh();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/membership/autopay/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscriptionId }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) refresh();
    else setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not cancel');
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        Cancel autopay
      </Button>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      <p>
        No more charges. {until ? `You keep your plan until ${new Date(until).toLocaleDateString('en-IN', { dateStyle: 'long' })}.` : 'You keep the month you paid for.'}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={cancel} disabled={busy || refreshing}>
          {busy || refreshing ? 'Cancelling…' : 'Yes, cancel autopay'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </Button>
      </div>
      {error && <p className="text-rose-600">{error}</p>}
    </div>
  );
}
