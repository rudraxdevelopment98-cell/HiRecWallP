import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ wallpaperId: z.string().uuid() });

/** The signed-in user's favourite wallpaper ids (RLS: own rows only). */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ signedIn: false, ids: [] });
  const { data } = await createClient().from('favourites').select('wallpaper_id');
  return NextResponse.json({ signedIn: true, ids: (data ?? []).map((r) => r.wallpaper_id) });
}

async function mutate(request: Request, add: boolean) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const supabase = createClient();
  const { error } = add
    ? await supabase
        .from('favourites')
        .upsert({ user_id: user.id, wallpaper_id: parsed.data.wallpaperId }, { onConflict: 'user_id,wallpaper_id', ignoreDuplicates: true })
    : await supabase.from('favourites').delete().eq('wallpaper_id', parsed.data.wallpaperId);
  if (error) return NextResponse.json({ error: 'Could not update favourites' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export const POST = (request: Request) => mutate(request, true);
export const DELETE = (request: Request) => mutate(request, false);
