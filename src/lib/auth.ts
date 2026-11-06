import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Current signed-in user (via request cookies), or null. Wrapped in React
 * `cache()` so the layout, the page and helpers share ONE auth round trip per
 * request instead of each calling Supabase.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = (await createClient());
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
});

/** True if the current user has the admin role (checked against profiles; cached per request). */
export const isAdminUser = cache(async (): Promise<boolean> => {
  try {
    const user = await getUser();
    if (!user) return false;
    const { data, error } = await (await createClient())
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data) return false;
    return data.role === 'admin';
  } catch {
    return false;
  }
});

/**
 * Signed-in user or redirect to login. Use in every protected page: layouts
 * and pages render in parallel, so a layout's check alone doesn't stop a
 * page from running.
 */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Admin or redirect. Call in every admin page (see requireUser). */
export async function requireAdmin(): Promise<void> {
  if (await isAdminUser()) return;
  // Signed-in non-admins go home; /login would send them straight back (redirect loop).
  redirect((await getUser()) ? '/' : '/login?next=/admin');
}
