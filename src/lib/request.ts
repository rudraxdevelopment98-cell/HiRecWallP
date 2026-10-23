import 'server-only';

import crypto from 'node:crypto';
import { serverEnv } from '@/lib/env';

/** Best-effort client IP from proxy headers. */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

/** Keyed hash of an IP (never store raw IPs). */
export function hashIp(ip: string): string {
  const secret = serverEnv().DOWNLOAD_TOKEN_SECRET;
  return crypto.createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
}
