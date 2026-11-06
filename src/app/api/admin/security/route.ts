import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard, audit } from '@/lib/admin';
import { getStaff } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { clearSettingsCache } from '@/lib/settings';

export const runtime = 'nodejs';

const schema = z.object({ require_staff_mfa: z.boolean() });

/** Owner: require two-factor sign-in for every staff member (recorded in settings history). */
export async function PUT(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const me = await getStaff();
  if (!me || me.role !== 'owner' || me.mfa !== 'ok') return NextResponse.json({ error: 'Only the owner can change this' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const s = createServiceClient();
  if (parsed.data.require_staff_mfa) {
    // Turn it on for yourself first, so the owner is never locked behind a step they haven't set up.
    const { data } = await s.auth.admin.getUserById(me.id);
    if (!(data.user?.factors ?? []).some((f) => f.status === 'verified')) {
      return NextResponse.json({ error: 'Set up two-factor for your own account first.' }, { status: 400 });
    }
  }
  const { error } = await s.rpc('save_setting', { p_key: 'security', p_value: { require_staff_mfa: parsed.data.require_staff_mfa }, p_actor: me.id, p_actor_email: me.email, p_note: null });
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 400 });
  clearSettingsCache();
  await audit('security.require_mfa', 'setting', 'security', parsed.data);
  return NextResponse.json({ ok: true });
}
