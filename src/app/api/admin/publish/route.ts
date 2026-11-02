import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminUser } from '@/lib/auth';
import { audit } from '@/lib/admin';
import { publishWallpapers } from '@/lib/publish';
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
    await publishWallpapers([parsed.data.wallpaperId]);
    await audit('wallpaper.publish', 'wallpaper', parsed.data.wallpaperId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Publish failed' }, { status: 503 });
  }
}
