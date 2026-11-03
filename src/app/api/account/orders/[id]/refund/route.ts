import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { allowRequest } from '@/lib/rate-limit';
import { selfRefund } from '@/lib/self-refund';

export const runtime = 'nodejs';

const schema = z.object({ note: z.string().trim().max(1000).default('') });

/** Instant refund for orders the Refund Policy covers automatically. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  if (!(await allowRequest(request, `self-refund:${user.id}`, 5, 3600))) return NextResponse.json({ error: 'Please wait a little before trying again.' }, { status: 429 });
  try {
    const r = await selfRefund(id, user.id, parsed.data.note);
    if (r.status === 'not_found') return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (r.status === 'not_eligible') return NextResponse.json({ error: r.reason, reviewable: r.reviewable, code: 'not_eligible' }, { status: 409 });
    return NextResponse.json({ ok: true, ticketId: r.ticketId, summary: r.summary });
  } catch (err) {
    console.error('[self-refund] failed', id, err);
    return NextResponse.json({ error: 'The refund could not be completed automatically. Please open a request and we’ll sort it out.' }, { status: 502 });
  }
}
