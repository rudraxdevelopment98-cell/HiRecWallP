import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';

/** Add today's free wallpaper to the signed-in user's library (once). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to get today’s free wallpaper.' }, { status: 401 });
  const settings = await getSettings();
  if (!settings.growth.daily_enabled) return NextResponse.json({ error: 'The daily free wallpaper is paused.' }, { status: 409 });
  const { data, error } = await createServiceClient().rpc('claim_daily_pick', { p_user: user.id, p_max_downloads: settings.downloads_per_purchase });
  if (error) return NextResponse.json({ error: 'Unavailable right now — please try again.' }, { status: 503 });
  const r = data as { status: string };
  if (r.status === 'none') return NextResponse.json({ error: 'Today’s wallpaper isn’t ready yet.' }, { status: 409 });
  return NextResponse.json(r);
}
