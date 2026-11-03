import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyUnsubscribe } from '@/lib/unsubscribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** One-click unsubscribe from a signed email link. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') ?? '').trim().toLowerCase();
  const token = url.searchParams.get('t') ?? '';
  const ok = email.length > 3 && token.length > 0 && verifyUnsubscribe(email, token);
  if (ok) await createServiceClient().from('newsletter_subscribers').delete().eq('email', email);
  const page = (msg: string) =>
    new NextResponse(
      `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center"><p>${msg}</p><p><a href="/">Back to the site</a></p></body>`,
      { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  return page(ok ? 'You’re unsubscribed. We won’t email you again.' : 'This unsubscribe link is invalid or expired.');
}

// RFC 8058 one-click unsubscribe (mail clients POST to the same URL).
export const POST = GET;
