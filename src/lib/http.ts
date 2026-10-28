import { publicEnv } from '@/lib/env';

/**
 * Sanitise a post-login `next` target to a same-site relative path, so the
 * sign-in flow can't be abused as an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/library'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}

/**
 * Minimal same-origin check for mutating route handlers (CSRF defense-in-depth).
 * Allows requests whose Origin matches the configured site URL, or same-host.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false; // require an Origin header on mutating requests
  try {
    const o = new URL(origin);
    const site = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
    if (o.host === site.host) return true;
    const host = request.headers.get('host');
    return host != null && o.host === host;
  } catch {
    return false;
  }
}
