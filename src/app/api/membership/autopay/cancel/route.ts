import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { cancelAutopay } from '@/lib/subscriptions';

export const runtime = 'nodejs';

const schema = z.object({ subscriptionId: z.string().uuid() });

/** Cancel the signed-in user's autopay. The paid month keeps running. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  try {
    await cancelAutopay(user.id, parsed.data.subscriptionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not cancel';
    return NextResponse.json({ error: msg === 'Subscription not found' ? msg : 'Could not cancel right now — please try again or contact support.' }, { status: msg === 'Subscription not found' ? 404 : 503 });
  }
}
