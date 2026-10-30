import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contact'), status: z.enum(['new', 'replied', 'closed']) }),
  z.object({ kind: z.literal('takedown'), status: z.enum(['open', 'reviewing', 'actioned', 'rejected']) }),
]);

/** Update a contact message or takedown report status. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const table = parsed.data.kind === 'contact' ? 'contact_messages' : 'takedown_reports';
  const { error } = await createServiceClient().from(table).update({ status: parsed.data.status }).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Could not update' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
