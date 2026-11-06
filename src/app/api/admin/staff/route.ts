import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard, audit, userIdByEmail } from '@/lib/admin';
import { getStaff } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { STAFF_ROLES } from '@/lib/staff';

export const runtime = 'nodejs';

const role = z.enum(STAFF_ROLES);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), email: z.string().trim().email().max(200), staffRole: role }),
  z.object({ action: z.literal('set_role'), userId: z.string().uuid(), staffRole: role }),
  z.object({ action: z.literal('remove'), userId: z.string().uuid() }),
  // Lost phone: remove their authenticator so they can set it up again.
  z.object({ action: z.literal('reset_mfa'), userId: z.string().uuid() }),
]);

/**
 * Owner only (middleware: area "staff"). Give an existing account a staff role,
 * change it, or take staff access away. The owner can't change or remove their
 * own access, so the store always keeps an owner.
 */
export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const me = await getStaff();
  if (!me || me.role !== 'owner' || me.mfa !== 'ok') return NextResponse.json({ error: 'Only the owner can manage staff' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  const a = parsed.data;
  const supabase = createServiceClient();

  if (a.action === 'add') {
    const id = await userIdByEmail(a.email);
    if (!id) return NextResponse.json({ error: 'No account with that email. Ask them to create one first, then add them here.' }, { status: 404 });
    if (id === me.id) return NextResponse.json({ error: 'That is you.' }, { status: 400 });
    const { error } = await supabase.from('profiles').update({ role: 'admin', staff_role: a.staffRole }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not add staff' }, { status: 400 });
    await audit('staff.add', 'user', id, { email: a.email, staffRole: a.staffRole });
    return NextResponse.json({ ok: true });
  }

  if (a.userId === me.id) return NextResponse.json({ error: 'You can’t change your own access.' }, { status: 400 });
  const { data: target } = await supabase.from('profiles').select('role').eq('id', a.userId).maybeSingle();
  if (target?.role !== 'admin') return NextResponse.json({ error: 'Not a staff account' }, { status: 404 });

  if (a.action === 'reset_mfa') {
    const { data } = await supabase.auth.admin.mfa.listFactors({ userId: a.userId });
    for (const f of data?.factors ?? []) await supabase.auth.admin.mfa.deleteFactor({ userId: a.userId, id: f.id });
    await audit('staff.reset_mfa', 'user', a.userId, { removed: data?.factors?.length ?? 0 });
    return NextResponse.json({ ok: true });
  }

  if (a.action === 'set_role') {
    const { error } = await supabase.from('profiles').update({ staff_role: a.staffRole }).eq('id', a.userId);
    if (error) return NextResponse.json({ error: 'Could not change the role' }, { status: 400 });
    await audit('staff.set_role', 'user', a.userId, { staffRole: a.staffRole });
    return NextResponse.json({ ok: true });
  }

  // remove: back to a customer (or creator, if they sell art).
  const { data: creator } = await supabase.from('creators').select('user_id').eq('user_id', a.userId).maybeSingle();
  const { error } = await supabase.from('profiles').update({ role: creator ? 'creator' : 'buyer', staff_role: null }).eq('id', a.userId);
  if (error) return NextResponse.json({ error: 'Could not remove staff access' }, { status: 400 });
  await audit('staff.remove', 'user', a.userId, {});
  return NextResponse.json({ ok: true });
}
