import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard, audit } from '@/lib/admin';
import { refundOrder } from '@/lib/refunds';

export const runtime = 'nodejs';

const schema = z.object({
  reason: z.string().trim().min(3).max(200),
  viaProvider: z.boolean(),
});

/** Admin: refund an order (Razorpay) and revoke what it unlocked. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Give a short reason for the refund.' }, { status: 400 });
  }
  try {
    const result = await refundOrder(id, parsed.data.reason, parsed.data.viaProvider);
    await audit('order.refund', 'order', id, { reason: parsed.data.reason, ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Refund failed' }, { status: 400 });
  }
}
