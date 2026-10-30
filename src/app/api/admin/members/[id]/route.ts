import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('revoke') }),
  z.object({ action: z.literal('restore') }),
  z.object({ action: z.literal('extend'), days: z.number().int().min(1).max(3660) }),
  z.object({ action: z.literal('allowance'), add: z.number().int().min(1).max(100000) }),
]);

/** Admin: revoke/restore a pass, extend it, or add to its allowance. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data: m } = await supabase.from('memberships').select('ends_at, download_limit').eq('id', params.id).maybeSingle();
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const a = parsed.data;
  const update =
    a.action === 'revoke'
      ? { status: 'revoked' }
      : a.action === 'restore'
        ? { status: 'active' }
        : a.action === 'extend'
          ? { ends_at: new Date(Math.max(Date.now(), new Date(m.ends_at as string).getTime()) + a.days * 86_400_000).toISOString() }
          : { download_limit: Number(m.download_limit) + a.add };
  const { error } = await supabase.from('memberships').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Could not update' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
