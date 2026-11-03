import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard, audit } from '@/lib/admin';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('credits'), amount: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, 'Amount cannot be 0'), note: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal('gift'), wallpaperId: z.string().uuid(), licence: z.enum(['personal', 'commercial']) }),
  z.object({ action: z.literal('block') }),
  z.object({ action: z.literal('unblock') }),
  z.object({ action: z.literal('role'), role: z.enum(['buyer', 'creator', 'admin']) }),
  // Customer moved country: change (or clear) the locked price country.
  z.object({ action: z.literal('price_country'), country: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/, 'Use a 2-letter country code, or leave blank to unlock') }),
]);

/** Admin actions on one customer: credits ±, gift a wallpaper, block/unblock, change role. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: parsed.success ? 'Invalid id' : parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const a = parsed.data;
  const me = await getUser();

  switch (a.action) {
    case 'credits': {
      const { error } = await supabase.from('credit_ledger').insert({ user_id: id, delta: a.amount, reason: 'admin_adjust' });
      if (error) return NextResponse.json({ error: 'Could not adjust credits' }, { status: 400 });
      break;
    }
    case 'gift': {
      const { error } = await supabase.rpc('grant_entitlement', {
        p_user: id,
        p_wallpaper: a.wallpaperId,
        p_order: null,
        p_licence: a.licence,
        p_max_downloads: (await getSettings()).downloads_per_purchase,
      });
      if (error) return NextResponse.json({ error: 'Could not gift (is the wallpaper id right?)' }, { status: 400 });
      break;
    }
    case 'block':
    case 'unblock': {
      if (me?.id === id) return NextResponse.json({ error: 'You cannot block yourself.' }, { status: 400 });
      // ~100 years = effectively permanent; 'none' lifts the ban.
      const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: a.action === 'block' ? '876000h' : 'none' });
      if (error) return NextResponse.json({ error: 'Could not update the account' }, { status: 400 });
      break;
    }
    case 'price_country': {
      const { error } = await supabase
        .from('profiles')
        .update({ price_country: a.country || null, price_locked_at: a.country ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) return NextResponse.json({ error: 'Could not change the price country' }, { status: 400 });
      break;
    }
    case 'role': {
      if (me?.id === id && a.role !== 'admin') return NextResponse.json({ error: 'You cannot remove your own admin role.' }, { status: 400 });
      const { error } = await supabase.from('profiles').update({ role: a.role }).eq('id', id);
      if (error) return NextResponse.json({ error: 'Could not change role' }, { status: 400 });
      break;
    }
  }
  await audit(`customer.${a.action}`, 'user', id, a);
  return NextResponse.json({ ok: true });
}
