import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { allowRequest } from '@/lib/rate-limit';
import { closeAccount } from '@/lib/account';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const schema = z.object({ confirm: z.string().trim().toLowerCase() });

/** Close my account. The person must type their email to confirm. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const email = (user.email ?? '').toLowerCase();
  if (!parsed.success || !email || parsed.data.confirm !== email) {
    return NextResponse.json({ error: 'Type your email address exactly to confirm.' }, { status: 400 });
  }
  if (!(await allowRequest(request, `close:${user.id}`, 3, 3600))) return NextResponse.json({ error: 'Please wait a little and try again.' }, { status: 429 });

  const r = await closeAccount(user.id, user.email ?? null);
  if (r.status === 'blocked') return NextResponse.json({ error: r.reason }, { status: 409 });
  if (r.status === 'error') return NextResponse.json({ error: 'Something went wrong. Nothing was charged; please contact support.' }, { status: 500 });
  // End this browser's session too (the login itself is already retired).
  await (await createClient()).auth.signOut({ scope: 'global' }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
