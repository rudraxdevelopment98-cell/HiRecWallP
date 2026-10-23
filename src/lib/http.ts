import { publicEnv } from '@/lib/env';

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
