/**
 * PaymentProvider adapter interface.
 *
 * Business logic depends ONLY on this interface, never on a concrete gateway.
 * Phase 1 ships a Razorpay implementation (INR per-item + International cards
 * for credit packs). Stripe / PayPal / a Merchant-of-Record can be added later
 * by implementing this interface without touching order/entitlement logic.
 *
 * Security rules this interface exists to enforce:
 *   - Entitlements/credits are granted ONLY from a verified webhook
 *     (`verifyWebhook` must validate the provider signature).
 *   - Webhook handling is idempotent on `providerEventId`.
 */

export type ProviderId = 'razorpay' | 'razorpay_intl' | 'paypal' | 'credits';

export interface CreateOrderInput {
  /** Amount in the currency's MINOR unit (paise/cents). */
  amountMinor: number;
  currency: string;
  /** Our internal order id, echoed back by the provider for reconciliation. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreatedOrder {
  providerId: ProviderId;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  /** Opaque data the client checkout widget needs (e.g. key id, order id). */
  checkout: Record<string, string>;
}

export interface WebhookVerificationResult {
  verified: boolean;
  /** Stable event id used for idempotency (dedupe in `webhook_events`). */
  providerEventId: string | null;
  eventType: string | null;
  /** The provider order id this event refers to, when applicable. */
  providerOrderId: string | null;
  /** Whether this event represents a successful payment. */
  paid: boolean;
}

export interface PaymentProvider {
  readonly id: ProviderId;

  /** Create a provider order for the given amount. */
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;

  /**
   * Verify a webhook request. MUST check the provider signature (HMAC-SHA256
   * for Razorpay) against the raw request body before trusting any field.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookVerificationResult;
}
