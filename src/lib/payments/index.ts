import 'server-only';

import type { PaymentProvider, ProviderId } from './provider';
import { RazorpayProvider } from './razorpay';

/**
 * Resolve a PaymentProvider by id. Business logic depends only on the returned
 * interface, so adding Stripe / PayPal / a Merchant-of-Record later means
 * registering it here — nothing else changes.
 */
export function getProvider(id: ProviderId): PaymentProvider {
  switch (id) {
    case 'razorpay':
      return new RazorpayProvider('razorpay');
    case 'razorpay_intl':
      return new RazorpayProvider('razorpay_intl');
    default:
      throw new Error(`Unsupported payment provider: ${id}`);
  }
}

export type { PaymentProvider, ProviderId } from './provider';
