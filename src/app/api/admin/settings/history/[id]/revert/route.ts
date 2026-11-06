import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { adminGuard, audit } from '@/lib/admin';
import { getStaff } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { DEFAULT_SETTINGS, clearSettingsCache } from '@/lib/settings';

export const runtime = 'nodejs';

/** Put a setting back to the value it had before one recorded change (itself recorded). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const me = await getStaff();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const s = createServiceClient();
  const { data: row } = await s.from('site_settings_history').select('id, key, old_value').eq('id', Number(id)).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Change not found' }, { status: 404 });
  // A setting saved for the first time had no stored value: going back means the built-in default.
  const previous = row.old_value ?? (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[row.key as string] ?? null;
  if (previous === null) return NextResponse.json({ error: 'This setting had no earlier value to go back to.' }, { status: 400 });
  if (row.key === 'security' && me.role !== 'owner') return NextResponse.json({ error: 'Only the owner can change security settings' }, { status: 403 });
  const { error } = await s.rpc('save_setting', { p_key: row.key, p_value: previous, p_actor: me.id, p_actor_email: me.email, p_note: `Reverted change #${row.id}` });
  if (error) return NextResponse.json({ error: 'Could not revert' }, { status: 400 });
  clearSettingsCache();
  await audit('settings.revert', 'setting', row.key as string, { change: row.id });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
