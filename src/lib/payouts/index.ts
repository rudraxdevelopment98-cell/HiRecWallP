import 'server-only';

import crypto from 'node:crypto';

/**
 * Payout + KYC adapters. Razorpay Route (India) and PayPal Payouts
 * (international) slot in behind this interface once keys/KYC are set; a
 * built-in mock lets onboarding and payout jobs run offline. Marketplace
 * operators may have TDS/TCS obligations in India — flagged for CA review.
 */

export type PayoutProviderId = 'razorpay_route' | 'paypal_payouts';
export type KycState = 'none' | 'pending' | 'verified' | 'rejected';

export interface KycResult {
  status: KycState;
  ref?: string;
  /** A hosted KYC/onboarding URL, when the real provider returns one. */
  url?: string;
}

export interface PayoutInput {
  creatorAccountId: string;
  amountMinor: number;
  currency: string;
  reference: string; // our creator_payouts id / period
}

export interface PayoutResult {
  ref: string;
  status: 'processing' | 'paid' | 'failed';
}

export interface PayoutProvider {
  readonly id: PayoutProviderId;
  startKyc(input: { creatorId: string; accountId: string }): Promise<KycResult>;
  createPayout(input: PayoutInput): Promise<PayoutResult>;
}

function mockProvider(id: PayoutProviderId): PayoutProvider {
  return {
    id,
    async startKyc(input): Promise<KycResult> {
      // Mock: auto-verify so onboarding completes offline.
      return {
        status: 'verified',
        ref: `mock_kyc_${crypto.createHash('sha1').update(input.accountId).digest('hex').slice(0, 12)}`,
      };
    },
    async createPayout(input): Promise<PayoutResult> {
      return {
        ref: `mock_payout_${crypto.createHash('sha1').update(input.reference).digest('hex').slice(0, 12)}`,
        status: 'paid',
      };
    },
  };
}

export function getPayoutProvider(id: PayoutProviderId): PayoutProvider {
  // Real providers require keys/KYC setup; fall back to mock until configured.
  if (id === 'razorpay_route' && process.env.RAZORPAY_KEY_SECRET) return mockProvider(id); // TODO: real Route
  if (id === 'paypal_payouts' && process.env.PAYPAL_CLIENT_SECRET) return mockProvider(id); // TODO: real Payouts
  return mockProvider(id);
}
