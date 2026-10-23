import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server Supabase client bound to the request cookies (anon key, RLS enforced).
 * Use in Server Components, route handlers and server actions to act AS the
 * signed-in user.
 */
export function createClient() {
  const cookieStore = cookies();
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anon = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Supabase public env not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).');
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `set` throws in a Server Component render; middleware refreshes the
          // session cookie instead, so this is safe to ignore here.
        }
      },
    },
  });
}
