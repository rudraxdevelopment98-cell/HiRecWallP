import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

/** Sign out (POST only, same-origin) and return home. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  try {
    await createClient().auth.signOut();
  } catch {
    // not configured / already signed out
  }
  return NextResponse.redirect(new URL('/', request.url), 303);
}
