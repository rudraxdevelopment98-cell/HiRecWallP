import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { allowRequest } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

/**
 * Change sign-in email. Supabase emails a confirmation link (to both the old
 * and new address with secure email change on); nothing changes until confirmed.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (parsed.data.email === (user.email ?? '').toLowerCase()) return NextResponse.json({ error: 'That’s already your email.' }, { status: 400 });
  if (!(await allowRequest(request, `email-change:${user.id}`, 3, 3600))) return NextResponse.json({ error: 'Please wait a little and try again.' }, { status: 429 });
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const { error } = await (await createClient()).auth.updateUser({ email: parsed.data.email }, { emailRedirectTo: `${site}/auth/callback?next=/account` });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return NextResponse.json({ error: taken ? 'That email is already used by another account.' : 'Could not start the change. Please try again.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
