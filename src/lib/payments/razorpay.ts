import 'server-only';

import crypto from 'node:crypto';
import type {
  CreateOrderInput,
  CreatedOrder,
  PaymentProvider,
  ProviderId,
  SubscriptionCapable,
  WebhookVerificationResult,
} from './provider';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

/**
 * Razorpay implementation of PaymentProvider. One class serves both the
 * domestic (`razorpay`, INR) and international (`razorpay_intl`, card) flows;
 * the currency comes from the order input.
 */
export class RazorpayProvider implements PaymentProvider, SubscriptionCapable {
  readonly id: ProviderId;

  constructor(id: Extract<ProviderId, 'razorpay' | 'razorpay_intl'>) {
    this.id = id;
  }

  // Reads only the Razorpay vars (not the full serverEnv), so payments don't
  // depend on storage being configured.
  private credentials() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
    }
    return { keyId, keySecret };
  }

  private async api<T>(path: string, body: unknown): Promise<T> {
    const { keyId, keySecret } = this.credentials();
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`${RAZORPAY_API}${path}`, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Razorpay ${path} failed (${res.status}): ${await res.text()}`);
    return (await res.json()) as T;
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const { keyId } = this.credentials();
    const order = await this.api<{ id: string; amount: number; currency: string }>('/orders', {
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
    });
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

  async ensureMonthlyPlan(input: { amountMinor: number; currency: string; name: string; existingPlanId?: string | null }): Promise<string> {
    if (input.existingPlanId) return input.existingPlanId;
    const plan = await this.api<{ id: string }>('/plans', {
      period: 'monthly',
      interval: 1,
      item: { name: input.name.slice(0, 100), amount: input.amountMinor, currency: input.currency },
    });
    return plan.id;
  }

  async createSubscription(input: { planId: string; totalCount: number; notes: Record<string, string> }) {
    const { keyId } = this.credentials();
    const sub = await this.api<{ id: string }>('/subscriptions', {
      plan_id: input.planId,
      total_count: input.totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: input.notes,
    });
    return { providerSubscriptionId: sub.id, checkout: { key: keyId, subscriptionId: sub.id } };
  }

  async cancelSubscription(providerSubscriptionId: string, atCycleEnd: boolean): Promise<void> {
    await this.api(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, {
      cancel_at_cycle_end: atCycleEnd ? 1 : 0,
    });
  }

  verifyWebhook(rawBody: string, headers: Record<string, string>): WebhookVerificationResult {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = headers['x-razorpay-signature'];

    const fail: WebhookVerificationResult = {
      verified: false,
      providerEventId: null,
      eventType: null,
      providerOrderId: null,
      paid: false,
      paymentId: null,
      international: false,
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
    const payment = payload.payload?.payment?.entity;
    const paymentId = payment?.id ?? null;
    const international = payment?.international === true;
    const sub = payload.payload?.subscription?.entity;
    const subscription = sub?.id
      ? {
          providerSubscriptionId: sub.id,
          status: sub.status ?? null,
          paidCount: typeof sub.paid_count === 'number' ? sub.paid_count : null,
          currentEnd: typeof sub.current_end === 'number' ? new Date(sub.current_end * 1000).toISOString() : null,
          notes: (sub.notes && typeof sub.notes === 'object' ? sub.notes : {}) as Record<string, string>,
        }
      : null;

    return {
      verified: true,
      providerEventId,
      eventType,
      // Subscription charges are handled by the subscription branch, not as orders.
      providerOrderId: subscription ? null : providerOrderId,
      paid: paid && !subscription,
      paymentId,
      international,
      amountMinor: typeof payment?.amount === 'number' ? payment.amount : null,
      currency: payment?.currency ?? null,
      subscription,
    };
  }

  async refundPayment(paymentId: string, reason: string): Promise<void> {
    await this.api(`/payments/${encodeURIComponent(paymentId)}/refund`, { speed: 'normal', notes: { reason } });
  }
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; international?: boolean; amount?: number; currency?: string } };
    order?: { entity?: { id?: string } };
    subscription?: { entity?: { id?: string; status?: string; paid_count?: number; current_end?: number; notes?: unknown } };
  };
}
