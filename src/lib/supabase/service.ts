import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/**
 * Service-role Supabase client. BYPASSES RLS — use ONLY on the server for
 * privileged, trusted flows: payment webhooks, credit spend, issuing signed
 * download URLs, admin writes. Never expose the service-role key to the client.
 */
export function createServiceClient() {
  const env = serverEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
