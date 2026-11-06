import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { canAccessArea, canAccessPath, effectiveRole, isMfaExempt, type Area, type StaffRole } from '@/lib/staff';
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

export interface StaffMember {
  id: string;
  email: string | null;
  role: StaffRole;
  /** Two-factor state: 'ok' (aal2 or not needed), 'verify' (has a factor, not used this session), 'setup' (required but none). */
  mfa: 'ok' | 'verify' | 'setup';
}

/**
 * The current staff member (profiles.role = 'admin'), or null. Cached per
 * request. staff_role narrows access (src/lib/staff.ts); a missing one counts
 * as owner.
 */
export const getStaff = cache(async (): Promise<StaffMember | null> => {
  try {
    const user = await getUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles').select('role, staff_role').eq('id', user.id).maybeSingle();
    if (error || !data || data.role !== 'admin') return null;
    let mfa: StaffMember['mfa'] = 'ok';
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') mfa = 'verify';
    else if (aal?.nextLevel !== 'aal2') {
      const { data: sec } = await supabase.from('site_settings').select('value').eq('key', 'security').maybeSingle();
      if ((sec?.value as { require_staff_mfa?: boolean } | null)?.require_staff_mfa) mfa = 'setup';
    }
    return { id: user.id, email: user.email, role: effectiveRole(data.staff_role as string | null), mfa };
  } catch {
    return null;
  }
});

/** True if the current user is staff (any staff role). Cached per request. */
export const isAdminUser = cache(async (): Promise<boolean> => Boolean(await getStaff()));

/** True if the current staff member may use an area (and has finished two-factor sign-in). */
export async function staffCan(area: Area): Promise<boolean> {
  const s = await getStaff();
  return Boolean(s && s.mfa === 'ok' && canAccessArea(s.role, area));
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

/**
 * Staff member allowed on this admin page, or redirect. Call in every admin page
 * (see requireUser). The page is read from the x-hw-path header set by
 * middleware, which applies the same rules first.
 */
export async function requireAdmin(): Promise<StaffMember> {
  const staff = await getStaff();
  // Signed-in non-admins go home; /login would send them straight back (redirect loop).
  if (!staff) redirect((await getUser()) ? '/' : '/login?next=/admin');
  const path = (await headers()).get('x-hw-path') ?? '/admin';
  if (staff.mfa !== 'ok' && !isMfaExempt(path)) redirect('/admin/security');
  if (!canAccessPath(staff.role, path)) redirect('/admin?denied=1');
  return staff;
}
