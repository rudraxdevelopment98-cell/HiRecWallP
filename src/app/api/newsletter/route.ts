import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { isSameOrigin } from '@/lib/http';
import { getSettings } from '@/lib/settings';
import { allowRequest, isBot } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().max(40).optional(),
});

/** Newsletter sign-up. Idempotent per email; admins export from the panel. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (isBot(body)) return NextResponse.json({ ok: true });
  if (!(await allowRequest(request, 'newsletter', 10, 3600))) {
    return NextResponse.json({ error: 'Too many requests — please try again later.' }, { status: 429 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });
  if (!(await getSettings()).newsletter_enabled) {
    return NextResponse.json({ error: 'Sign-ups are closed right now.' }, { status: 403 });
  }
  try {
    const { error } = await createServiceClient()
      .from('newsletter_subscribers')
      .upsert({ email: parsed.data.email, source: parsed.data.source ?? 'site' }, { onConflict: 'email', ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Sign-up is unavailable right now.' }, { status: 503 });
  }
}
