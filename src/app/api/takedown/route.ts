import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  reporter_email: z.string().email(),
  url: z.string().url().optional().or(z.literal('')),
  details: z.string().min(5).max(5000),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('takedown_reports').insert({
      reporter_email: parsed.data.reporter_email,
      url: parsed.data.url || null,
      details: parsed.data.details,
      status: 'open',
    });
    if (error) throw error;
  } catch {
    // Service not configured yet, or insert failed.
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
