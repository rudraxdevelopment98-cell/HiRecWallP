import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { loadSellable } from '@/lib/pricing';
import { memberUnlock } from '@/lib/membership';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';

const schema = z.object({ wallpaperId: z.string().uuid() });

/** Members: add a wallpaper to the library using their pass allowance. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    if (!(await loadSellable([parsed.data.wallpaperId])).has(parsed.data.wallpaperId)) {
      return NextResponse.json({ error: 'This wallpaper is not available.' }, { status: 400 });
    }
    const settings = await getSettings();
    const entitlementId = await memberUnlock(user.id, parsed.data.wallpaperId, settings.downloads_per_purchase);
    if (!entitlementId) {
      return NextResponse.json(
        { error: 'No active membership, or this pass’s allowance is used up.', code: 'no_allowance' },
        { status: 402 },
      );
    }
    return NextResponse.json({ ok: true, entitlementId });
  } catch {
    return NextResponse.json({ error: 'Unavailable right now' }, { status: 503 });
  }
}
