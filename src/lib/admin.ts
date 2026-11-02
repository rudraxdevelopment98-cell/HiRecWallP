import 'server-only';

import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth';
import { isSameOrigin } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

/** Null when the caller is an admin (and same-origin for mutations), else an error response. */
export async function adminGuard(request: Request, mutating = true): Promise<NextResponse | null> {
  if (mutating && !isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!(await isAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

/** All auth users (id → email etc.). Admin pages only. */
export async function listAuthUsers(): Promise<AdminUser[]> {
  const out: AdminUser[] = [];
  const admin = createServiceClient().auth.admin;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) {
      out.push({ id: u.id, email: u.email ?? null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

/** Sum minor amounts per currency → "₹1,234 · $56.00". */
export function sumByCurrency(rows: { amount_minor: number; currency: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount_minor);
  return m;
}

/**
 * Record an admin action in the audit log (who did what, to what). Never
 * throws: logging must not block the action itself.
 */
export async function audit(
  action: string,
  targetType?: string,
  targetId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const { getUser } = await import('@/lib/auth');
    const user = await getUser();
    await createServiceClient()
      .from('admin_audit')
      .insert({
        actor_id: user?.id ?? null,
        actor_email: user?.email ?? null,
        action,
        target_type: targetType ?? null,
        target_id: targetId ?? null,
        details: details ?? null,
      });
  } catch (err) {
    console.error('[audit] failed', action, err);
  }
}

/** id → email for just these users (profiles.email is synced from auth). */
export async function emailsFor(userIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await createServiceClient().from('profiles').select('id, email').in('id', ids.slice(i, i + 500));
    for (const r of data ?? []) out.set(r.id as string, (r.email as string | null) ?? null);
  }
  return out;
}

/** Find an account by email (case-insensitive). */
export async function userIdByEmail(email: string): Promise<string | null> {
  const { data } = await createServiceClient().from('profiles').select('id').ilike('email', email.trim()).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
