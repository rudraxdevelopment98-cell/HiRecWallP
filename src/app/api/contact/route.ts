import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { isSameOrigin } from '@/lib/http';
import { allowRequest, isBot } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(5).max(5000),
});

/** Contact form → contact_messages (read and answered from Admin → Messages). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (isBot(body)) return NextResponse.json({ ok: true });
  if (!(await allowRequest(request, 'contact', 5, 3600))) {
    return NextResponse.json({ error: 'Too many requests — please try again later.' }, { status: 429 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Please fill in your name, email and a message.' }, { status: 400 });
  try {
    const user = await getUser();
    const { error } = await createServiceClient()
      .from('contact_messages')
      .insert({ ...parsed.data, user_id: user?.id ?? null });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not send right now.' }, { status: 503 });
  }
}
