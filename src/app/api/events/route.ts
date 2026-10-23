import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { getDisplayRegion } from '@/lib/catalogue';
import { createServiceClient } from '@/lib/supabase/service';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({
  type: z.enum([
    'view',
    'detail_view',
    'preview_zoom',
    'free_download',
    'add_to_cart',
    'checkout_start',
    'purchase',
    'paid_download',
  ]),
  wallpaperId: z.string().uuid().optional(),
  anonId: z.string().max(64).optional(),
});

/** Lightweight analytics sink. Events are written server-side (service role). */
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
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    const [user, region] = [await getUser(), getDisplayRegion()];
    const country = request.headers.get('x-vercel-ip-country') ?? null;
    const supabase = createServiceClient();
    await supabase.from('events').insert({
      user_id: user?.id ?? null,
      anon_id: parsed.data.anonId ?? null,
      type: parsed.data.type,
      wallpaper_id: parsed.data.wallpaperId ?? null,
      region_code: region,
      country_code: country,
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    // Analytics must never break the page.
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
