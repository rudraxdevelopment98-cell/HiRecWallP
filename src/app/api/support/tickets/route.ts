import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { allowRequest, isBot } from '@/lib/rate-limit';
import { createTicket } from '@/lib/support';
import { TICKET_CATEGORIES } from '@/lib/support-rules';

export const runtime = 'nodejs';

const schema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().trim().min(3, 'Add a short subject').max(140),
  body: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(5000),
  orderId: z.string().uuid().nullish(),
  wallpaperId: z.string().uuid().nullish(),
});

/** Open a support request (signed-in customers). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const raw = await request.json().catch(() => null);
  if (isBot(raw)) return NextResponse.json({ ok: true });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  if (!(await allowRequest(request, `ticket:${user.id}`, 5, 3600))) {
    return NextResponse.json({ error: 'Too many requests in a short time — please add details to an existing request.' }, { status: 429 });
  }
  try {
    const t = await createTicket({ userId: user.id, ...parsed.data });
    return NextResponse.json({ id: t.id, number: t.number });
  } catch (err) {
    console.error('[support] create failed', err);
    return NextResponse.json({ error: 'Could not send your request. Please try again.' }, { status: 503 });
  }
}
