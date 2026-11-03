import 'server-only';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { hashIp } from '@/lib/request';
import { POLICIES } from '@/lib/policies';

type Context = 'signup' | 'checkout' | 'creator_onboarding' | 'update';
type Policy = 'terms' | 'privacy' | 'refunds' | 'delivery' | 'licence' | 'creator';

/**
 * Record that a user accepted the current version of policies (idempotent per
 * user + policy + version). Never blocks the user flow if it fails.
 */
export async function recordAcceptance(userId: string, policies: Policy[], context: Context): Promise<void> {
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip');
    const ipHash = ip ? hashIp(ip) : null;
    const rows = policies.map((p) => ({
      user_id: userId,
      policy: p,
      version: p === 'creator' ? POLICIES.terms.version : POLICIES[p].version,
      context,
      ip_hash: ipHash,
    }));
    await createServiceClient().from('policy_acceptances').upsert(rows, { onConflict: 'user_id,policy,version', ignoreDuplicates: true });
  } catch {
    /* consent logging must never break sign-in or checkout */
  }
}
