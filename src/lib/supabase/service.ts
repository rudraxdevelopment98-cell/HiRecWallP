import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. BYPASSES RLS — use ONLY on the server for
 * privileged, trusted flows: payment webhooks, credit spend, issuing signed
 * download URLs, admin writes. Never expose the service-role key to the client.
 */
export function createServiceClient() {
  // Reads only the Supabase vars (not the full serverEnv), so database flows
  // like checkout and webhooks don't depend on storage being configured.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
