import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard, listAuthUsers } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  days: z.number().int().min(1).max(3660),
  download_limit: z.number().int().min(1).max(100000),
  includes_commercial: z.boolean(),
  note: z.string().trim().max(200).optional(),
});

/** Admin: give a free (complimentary) pass to an existing account. */
export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

  const user = (await listAuthUsers()).find((u) => u.email?.toLowerCase() === parsed.data.email);
  if (!user) return NextResponse.json({ error: 'No account with that email — they need to sign in once first.' }, { status: 404 });

  const now = Date.now();
  const { error } = await createServiceClient()
    .from('memberships')
    .insert({
      user_id: user.id,
      starts_at: new Date(now).toISOString(),
      ends_at: new Date(now + parsed.data.days * 86_400_000).toISOString(),
      download_limit: parsed.data.download_limit,
      includes_commercial: parsed.data.includes_commercial,
      note: parsed.data.note || 'Complimentary (admin)',
    });
  if (error) return NextResponse.json({ error: 'Could not create pass' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
