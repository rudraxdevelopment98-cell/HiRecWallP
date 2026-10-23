import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isAdminUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const schema = z.object({ wallpaperId: z.string().uuid() });

/**
 * Publish a wallpaper: set status=published and seed a price per region from
 * the global rule (launch price when set), then revalidate the catalogue.
 * Prices are only ever written server-side.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    const supabase = createServiceClient();

    const { error: upErr } = await supabase
      .from('wallpapers')
      .update({ status: 'published', launch_at: new Date().toISOString() })
      .eq('id', parsed.data.wallpaperId);
    if (upErr) throw upErr;

    // Seed a price per region from the global rule (launch price if present).
    const { data: rules } = await supabase
      .from('price_rules')
      .select('region_code, base_price, launch_price')
      .eq('scope', 'global');

    for (const rule of rules ?? []) {
      const price = rule.launch_price ?? rule.base_price;
      await supabase.from('prices').upsert(
        {
          wallpaper_id: parsed.data.wallpaperId,
          region_code: rule.region_code,
          current_price: price,
        },
        { onConflict: 'wallpaper_id,region_code' },
      );
    }

    revalidatePath('/');
    revalidatePath('/explore');
    revalidatePath('/free');

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Publish failed' }, { status: 503 });
  }
}
