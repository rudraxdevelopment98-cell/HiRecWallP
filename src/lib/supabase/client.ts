'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/**
 * Browser Supabase client (anon key). Subject to RLS. Safe for the client
 * bundle — uses only NEXT_PUBLIC_* values.
 */
export function createClient() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anon = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Supabase public env not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).');
  }
  return createBrowserClient(url, anon);
}
