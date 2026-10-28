import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getDisplayRegion } from '@/lib/catalogue';
import { unlockWithCredits } from '@/lib/credits';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  wallpaperId: z.string().uuid(),
  licence: z.enum(['personal', 'commercial']).default('personal'),
});

/**
 * Spend credits to unlock one wallpaper (international regions). Atomic and
 * double-spend-safe via spend_credits_and_entitle; 402 when the balance is short.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    return await unlockWithCredits(user.id, [parsed.data], getDisplayRegion());
  } catch {
    return NextResponse.json({ error: 'Unlock unavailable' }, { status: 503 });
  }
}
