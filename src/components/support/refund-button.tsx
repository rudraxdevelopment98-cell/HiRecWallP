'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRefresh } from '@/lib/use-refresh';

/** Instant refund for an eligible order, with a clear confirmation step. */
export function RefundButton({ orderId, summary }: { orderId: string; summary: string }) {
  const { refresh, refreshing } = useRefresh();
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [ticketId, setTicketId] = useState('');

  if (step === 'done') {
    return (
      <p className="text-sm text-emerald-700" role="status">
        Refunded. {msg}{' '}
        {ticketId && (
          <Link href={`/account/support/${ticketId}`} className="underline">
            Details
          </Link>
        )}
      </p>
    );
  }
  if (step === 'idle') {
    return (
      <Button variant="outline" size="sm" onClick={() => setStep('confirm')}>
        Refund
      </Button>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-lg border bg-secondary/40 p-3 text-sm sm:w-auto sm:max-w-sm">
      <p>
        Refund this order in full? {summary} The money goes back to your original payment method (usually 5–7 business days).
      </p>
      {step === 'error' && (
        <p className="text-rose-600" role="alert">
          {msg}{' '}
          <Link href={`/account/support/new?order=${orderId}&category=refund`} className="underline">
            Ask us instead
          </Link>
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={step === 'busy' || refreshing}
          onClick={async () => {
            setStep('busy');
            const res = await fetch(`/api/account/orders/${orderId}/refund`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({}),
            }).catch(() => null);
            const data = (await res?.json().catch(() => null)) as { error?: string; summary?: string; ticketId?: string } | null;
            if (res?.ok) {
              setMsg(data?.summary ?? '');
              setTicketId(data?.ticketId ?? '');
              setStep('done');
              refresh();
            } else {
              setMsg(data?.error ?? 'The refund could not be completed.');
              setStep('error');
            }
          }}
        >
          {step === 'busy' ? 'Refunding…' : 'Yes, refund'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setStep('idle')} disabled={step === 'busy'}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
