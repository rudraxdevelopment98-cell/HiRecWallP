import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { allowRequest } from '@/lib/rate-limit';
import { addCustomerReply } from '@/lib/support';

export const runtime = 'nodejs';

const schema = z.object({ body: z.string().trim().min(1).max(5000) });

/** Customer adds a message to their own request (reopens it if resolved). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Write a message first' }, { status: 400 });
  if (!(await allowRequest(request, `ticket-reply:${user.id}`, 30, 3600))) return NextResponse.json({ error: 'Too many messages — please wait a bit.' }, { status: 429 });
  const r = await addCustomerReply(id, user.id, parsed.data.body);
  if (r === 'not_found') return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (r === 'closed') return NextResponse.json({ error: 'This request is closed — please open a new one.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
