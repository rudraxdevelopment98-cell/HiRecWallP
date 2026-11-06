import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { claimWelcomeBonus } from '@/lib/growth';

export const runtime = 'nodejs';

/** After a password sign-in (no auth callback runs): welcome bonus + consent records. Idempotent. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const r = await claimWelcomeBonus(user.id);
  return NextResponse.json({ status: r.status });
}
