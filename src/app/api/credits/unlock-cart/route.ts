import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getDisplayRegion } from '@/lib/catalogue';
import { unlockWithCredits } from '@/lib/credits';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  items: z
    .array(
      z.object({
        wallpaperId: z.string().uuid(),
        licence: z.enum(['personal', 'commercial']).default('personal'),
      }),
    )
    .min(1)
    .max(20),
});

/** Spend credits on every item in the cart. 402 with `needed`/`balance` when short. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    return await unlockWithCredits(user.id, parsed.data.items, (await getDisplayRegion()));
  } catch {
    return NextResponse.json({ error: 'Unlock unavailable' }, { status: 503 });
  }
}
