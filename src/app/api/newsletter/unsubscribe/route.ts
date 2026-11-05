import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyUnsubscribe } from '@/lib/unsubscribe';
import { escapeHtml } from '@/lib/gift-rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const page = (body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe</title><body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center">${body}<p><a href="/">Back to the site</a></p></body>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

function params(url: URL) {
  const email = (url.searchParams.get('e') ?? '').trim().toLowerCase();
  const token = url.searchParams.get('t') ?? '';
  return { email, token, ok: email.length > 3 && token.length > 0 && verifyUnsubscribe(email, token) };
}

/**
 * GET only shows a confirm button: email security scanners open links
 * automatically, and a GET that unsubscribes would silently drop people.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { email, ok } = params(url);
  if (!ok) return page('<p>This unsubscribe link is invalid or expired.</p>', 400);
  const action = `${url.pathname}${url.search}`;
  return page(
    `<p>Stop emails to <strong>${escapeHtml(email)}</strong>?</p><form method="post" action="${escapeHtml(action)}"><button type="submit" style="padding:10px 18px;border-radius:8px;border:0;background:#111;color:#fff;font-size:15px;cursor:pointer">Unsubscribe</button></form>`,
  );
}

/** Confirmed unsubscribe — also the RFC 8058 one-click POST from mail clients. */
export async function POST(request: Request) {
  const { email, ok } = params(new URL(request.url));
  if (!ok) return page('<p>This unsubscribe link is invalid or expired.</p>', 400);
  await createServiceClient().from('newsletter_subscribers').delete().eq('email', email);
  return page('<p>You’re unsubscribed. We won’t email you again.</p>');
}
