'use client';

/** Browser-side helpers for Razorpay Standard Checkout. */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (resp: { error?: { description?: string } }) => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loading: Promise<RazorpayCtor> | null = null;

export function loadRazorpay(): Promise<RazorpayCtor> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay unavailable')));
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load Razorpay checkout'));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export type PaymentOutcome =
  | { status: 'success'; paymentId: string }
  | { status: 'dismissed'; reason: string | null };

/**
 * Open Razorpay Checkout for an order created server-side. The success handler
 * only means the widget finished: access is granted by the verified webhook,
 * which the success page polls for.
 */
export async function payWithRazorpay(opts: {
  checkout: Record<string, string>;
  name: string;
  description: string;
  email?: string | null;
  method?: 'upi' | 'card' | 'netbanking';
}): Promise<PaymentOutcome> {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    let failure: string | null = null;
    const rzp = new Razorpay({
      key: opts.checkout.key,
      order_id: opts.checkout.orderId,
      amount: opts.checkout.amount,
      currency: opts.checkout.currency,
      name: opts.name,
      description: opts.description,
      prefill: { email: opts.email ?? undefined, method: opts.method },
      theme: { color: '#111827' },
      handler: (resp: { razorpay_payment_id: string }) =>
        resolve({ status: 'success', paymentId: resp.razorpay_payment_id }),
      modal: { ondismiss: () => resolve({ status: 'dismissed', reason: failure }) },
    });
    rzp.on('payment.failed', (resp) => {
      failure = resp.error?.description ?? 'Payment failed';
    });
    rzp.open();
  });
}
