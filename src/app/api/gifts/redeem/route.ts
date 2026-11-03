import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { allowRequest } from '@/lib/rate-limit';
import { REDEEM_MESSAGE, redeemGift } from '@/lib/gifts';

export const runtime = 'nodejs';

const schema = z.object({ code: z.string().trim().min(12).max(20) });

/** Redeem a gift code into the signed-in user's credits. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to redeem.' }, { status: 401 });
  if (!(await allowRequest(request, 'gift_redeem', 20, 3600))) {
    return NextResponse.json({ error: 'Too many attempts — please try again later.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: REDEEM_MESSAGE.invalid }, { status: 400 });
  try {
    const result = await redeemGift(user.id, parsed.data.code);
    if (result.status === 'redeemed') return NextResponse.json(result);
    return NextResponse.json({ error: REDEEM_MESSAGE[result.status] ?? 'Could not redeem.', status: result.status }, { status: 409 });
  } catch {
    return NextResponse.json({ error: 'Redeeming is unavailable right now.' }, { status: 503 });
  }
}
