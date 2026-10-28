'use client';

import { useEffect, useState } from 'react';

type State = 'pending' | 'paid' | 'refunded' | 'failed' | 'timeout';

/**
 * Polls a real order until the verified webhook marks it paid. The Razorpay
 * widget's success callback alone never grants access, so this is what tells
 * the buyer their downloads are ready.
 */
export function OrderStatus({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>('pending');

  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function poll() {
      tries += 1;
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' });
        if (res.ok) {
          const { status } = (await res.json()) as { status: string };
          if (status === 'paid' || status === 'refunded' || status === 'failed') {
            setState(status);
            return;
          }
        }
      } catch {
        // keep polling
      }
      if (stopped) return;
      if (tries >= 30) setState('timeout');
      else timer = setTimeout(poll, 2000);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  const copy: Record<State, string> = {
    pending: 'Confirming your payment with the bank… this usually takes a few seconds.',
    paid: 'Payment confirmed. Your wallpapers are ready in your library.',
    refunded:
      'This payment used a card issued outside India, so INR pricing does not apply. It has been refunded in full — please check out again with your billing country to pay in credits.',
    failed: 'The payment did not complete. No access was granted.',
    timeout:
      'Still waiting for confirmation from the payment provider. Your library will update automatically once it arrives — no need to pay again.',
  };

  return (
    <p className="text-sm text-muted-foreground" data-order-status={state}>
      {copy[state]}
    </p>
  );
}
