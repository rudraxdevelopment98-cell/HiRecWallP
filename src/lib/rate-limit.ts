import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { clientIp, hashIp } from '@/lib/request';

/**
 * Shared (database-backed) rate limit keyed by action + hashed IP.
 * Fails open: if the check itself errors, the request is allowed.
 */
export async function allowRequest(request: Request, action: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const key = `${action}:${hashIp(clientIp(request))}`;
    const { data, error } = await createServiceClient().rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_s: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** Hidden form field humans never see; bots fill it in. */
export const HONEYPOT_FIELD = 'website';
export function isBot(body: unknown): boolean {
  return Boolean(body && typeof body === 'object' && (body as Record<string, unknown>)[HONEYPOT_FIELD]);
}
