import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface SessionUser {
  id: string;
  email: string | null;
}

/** Current signed-in user (via request cookies), or null. */
export async function getUser(): Promise<SessionUser | null> {
  try {
    const supabase = (await createClient());
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/** True if the current user has the admin role (checked against profiles). */
export async function isAdminUser(): Promise<boolean> {
  try {
    const supabase = (await createClient());
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return false;
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (error || !data) return false;
    return data.role === 'admin';
  } catch {
    return false;
  }
}

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
  if (!(await isAdminUser())) redirect('/login?next=/admin');
}
