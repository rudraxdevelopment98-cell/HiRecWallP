import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Sign out on every device (revokes all refresh tokens for this account). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const { error } = await (await createClient()).auth.signOut({ scope: 'global' });
  if (error) return NextResponse.json({ error: 'Could not sign out everywhere. Please try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
