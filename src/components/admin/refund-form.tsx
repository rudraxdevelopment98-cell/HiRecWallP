'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/** Refund with a reason; two-step confirm built into the page. */
export function RefundForm({ orderId, canRefundAtProvider }: { orderId: string; canRefundAtProvider: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [viaProvider, setViaProvider] = useState(canRefundAtProvider);
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function refund() {
    setState('busy');
    const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason, viaProvider }),
    }).catch(() => null);
    const json = ((await res?.json().catch(() => null)) ?? {}) as { error?: string; entitlementsRemoved?: number; creditsReversed?: number; passesRevoked?: number };
    if (res?.ok) {
      setState('done');
      setMsg(`Refunded. Removed ${json.entitlementsRemoved ?? 0} wallpaper(s), reversed ${json.creditsReversed ?? 0} credit(s), revoked ${json.passesRevoked ?? 0} pass(es).`);
      router.refresh();
    } else {
      setState('error');
      setMsg(json.error ?? 'Refund failed');
      setConfirming(false);
    }
  }

  if (state === 'done') return <p className="text-sm text-emerald-600">{msg}</p>;
  return (
    <div className="space-y-3 text-sm">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Reason (shown in the activity log)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. charged twice, file faulty" className="input" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={viaProvider} disabled={!canRefundAtProvider} onChange={(e) => setViaProvider(e.target.checked)} />
        Send the money back through Razorpay
        {!canRefundAtProvider && <span className="text-xs text-muted-foreground">(no payment id — refund in the Razorpay dashboard)</span>}
      </label>
      {!confirming ? (
        <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => setConfirming(true)}>
          Refund order…
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3">
          <span className="text-rose-700">
            {viaProvider ? 'Refund the money and remove access?' : 'Remove access (money already refunded elsewhere)?'}
          </span>
          <Button size="sm" onClick={refund} disabled={state === 'busy'}>
            {state === 'busy' ? 'Refunding…' : 'Yes, refund'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      )}
      {state === 'error' && <p className="text-rose-600">{msg}</p>}
    </div>
  );
}
