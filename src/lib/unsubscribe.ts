import 'server-only';

import crypto from 'node:crypto';

function secret(): string {
  return (
    process.env.DOWNLOAD_TOKEN_SECRET ??
    crypto.createHash('sha256').update(`hw-unsub:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex')
  );
}

/** Signed token so unsubscribe links can't be forged for other addresses. */
export function unsubscribeToken(email: string): string {
  return crypto.createHmac('sha256', secret()).update(email.toLowerCase()).digest('base64url').slice(0, 32);
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  const a = Buffer.from(unsubscribeToken(email));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  return `${site}/api/newsletter/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;
}
