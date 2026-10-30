import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const schema = z
  .object({
    kyc_status: z.enum(['none', 'pending', 'verified', 'rejected']),
    commission_pct: z.coerce.number().min(0).max(90),
  })
  .partial();

/** Admin: set a creator's KYC status or commission. */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { error } = await createServiceClient().from('creators').update(parsed.data).eq('user_id', params.id);
  if (error) return NextResponse.json({ error: 'Could not update' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
