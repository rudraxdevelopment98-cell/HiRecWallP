import 'server-only';

import crypto from 'node:crypto';
import { serverEnv } from '@/lib/env';
import type {
  CreateOrderInput,
  CreatedOrder,
  PaymentProvider,
  ProviderId,
  WebhookVerificationResult,
} from './provider';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

/**
 * Razorpay implementation of PaymentProvider. One class serves both the
 * domestic (`razorpay`, INR) and international (`razorpay_intl`, card) flows;
 * the currency comes from the order input.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly id: ProviderId;

  constructor(id: Extract<ProviderId, 'razorpay' | 'razorpay_intl'>) {
    this.id = id;
  }

  private credentials() {
    const env = serverEnv();
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
    }
    return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const { keyId, keySecret } = this.credentials();
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const res = await fetch(`${RAZORPAY_API}/orders`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Razorpay order creation failed (${res.status}): ${detail}`);
    }

    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      providerId: this.id,
      providerOrderId: order.id,
      amountMinor: order.amount,
      currency: order.currency,
      checkout: {
        key: keyId,
        orderId: order.id,
        amount: String(order.amount),
        currency: order.currency,
      },
    };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookVerificationResult {
    const env = serverEnv();
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    const signature = headers['x-razorpay-signature'];

    const fail: WebhookVerificationResult = {
      verified: false,
      providerEventId: null,
      eventType: null,
      providerOrderId: null,
      paid: false,
    };

    if (!secret || !signature) return fail;

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return fail;
    }

    let payload: RazorpayWebhookBody;
    try {
      payload = JSON.parse(rawBody) as RazorpayWebhookBody;
    } catch {
      return fail;
    }

    const eventType = payload.event ?? null;
    const paid = eventType === 'payment.captured' || eventType === 'order.paid';
    const providerOrderId =
      payload.payload?.order?.entity?.id ??
      payload.payload?.payment?.entity?.order_id ??
      null;
    // Prefer the dedicated event-id header for idempotency; fall back to the
    // payment entity id (still stable per event for our purposes).
    const providerEventId =
      headers['x-razorpay-event-id'] ?? payload.payload?.payment?.entity?.id ?? null;

    return { verified: true, providerEventId, eventType, providerOrderId, paid };
  }
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
}
