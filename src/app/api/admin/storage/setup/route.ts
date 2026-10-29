import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { publicEnv } from '@/lib/env';
import { applyStorageRules } from '@/lib/r2';

export const runtime = 'nodejs';

/** Admin: apply R2 CORS + lifecycle cleanup rules (safe to run repeatedly). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const origins = new Set([publicEnv.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000']);
  const origin = request.headers.get('origin');
  if (origin) origins.add(origin);
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);

  try {
    await applyStorageRules([...origins]);
    return NextResponse.json({ ok: true, origins: [...origins] });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not apply storage rules', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
