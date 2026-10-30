import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase Auth landing: exchanges an OAuth/PKCE `code` (Google, magic link)
 * or verifies an email `token_hash`, sets the session cookie, then redirects
 * to a same-site `next` path only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  try {
    const supabase = (await createClient());
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    }
  } catch {
    // fall through
  }
  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
