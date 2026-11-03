import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminGuard, audit } from '@/lib/admin';
import { getUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { refundOrder } from '@/lib/refunds';
import { addStaffReply, addSystemNote, setTicketStatus, TICKET_FIELDS, type Ticket } from '@/lib/support';
import { ticketRef } from '@/lib/support-rules';

export const runtime = 'nodejs';

const status = z.enum(['open', 'waiting_customer', 'resolved', 'closed']);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reply'), body: z.string().trim().min(1).max(5000), internal: z.boolean().default(false), status: status.optional() }),
  z.object({ action: z.literal('status'), status, resolution: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal('assign'), toMe: z.boolean() }),
  z.object({ action: z.literal('priority'), priority: z.enum(['normal', 'high']) }),
  z.object({ action: z.literal('refund'), reason: z.string().trim().min(3).max(200), viaProvider: z.boolean() }),
  z.object({ action: z.literal('credits'), amount: z.number().int().min(1).max(10000), note: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal('restore_downloads'), entitlementId: z.string().uuid() }),
]);

/** Admin actions on a support ticket; every action is audited and noted in the thread. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const denied = await adminGuard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: parsed.success ? 'Invalid ticket' : parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const s = createServiceClient();
  const { data: t } = await s.from('support_tickets').select(TICKET_FIELDS).eq('id', id).maybeSingle<Ticket>();
  if (!t) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  const me = await getUser();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const a = parsed.data;
  const ref = ticketRef(t.number);

  try {
    switch (a.action) {
      case 'reply':
        await addStaffReply({ ticketId: t.id, staffId: me.id, body: a.body, internal: a.internal, status: a.status });
        await audit(a.internal ? 'support.note' : 'support.reply', 'ticket', t.id, { ref, status: a.status });
        break;
      case 'status':
        await setTicketStatus(t.id, a.status, a.resolution);
        await audit('support.status', 'ticket', t.id, { ref, status: a.status, resolution: a.resolution });
        break;
      case 'assign':
        await s.from('support_tickets').update({ assigned_to: a.toMe ? me.id : null }).eq('id', t.id);
        break;
      case 'priority':
        await s.from('support_tickets').update({ priority: a.priority }).eq('id', t.id);
        break;
      case 'refund': {
        if (!t.order_id) return NextResponse.json({ error: 'This request isn’t linked to an order.' }, { status: 400 });
        const r = await refundOrder(t.order_id, `${ref}: ${a.reason}`, a.viaProvider);
        await addSystemNote(
          t.id,
          a.viaProvider
            ? 'Your order was refunded. The money goes back to your original payment method; banks usually show it within 5–7 business days.'
            : 'Your order was refunded and what it unlocked was removed.',
        );
        await audit('order.refund', 'order', t.order_id, { ref, reason: a.reason, ...r });
        break;
      }
      case 'credits': {
        const { error } = await s.from('credit_ledger').insert({ user_id: t.user_id, delta: a.amount, reason: 'admin_adjust', ref_id: t.id });
        if (error) throw error;
        await addSystemNote(t.id, `We added ${a.amount} credit${a.amount === 1 ? '' : 's'} to your account${a.note ? ` (${a.note})` : ''}.`);
        await audit('support.credits', 'ticket', t.id, { ref, amount: a.amount, note: a.note });
        break;
      }
      case 'restore_downloads': {
        const { data: e } = await s
          .from('entitlements')
          .update({ downloads_used: 0 })
          .eq('id', a.entitlementId)
          .eq('user_id', t.user_id)
          .select('id, max_downloads, wallpapers(title)')
          .maybeSingle();
        if (!e) return NextResponse.json({ error: 'That wallpaper isn’t in this customer’s library.' }, { status: 400 });
        const title = (e.wallpapers as unknown as { title: string } | null)?.title ?? 'the wallpaper';
        await addSystemNote(t.id, `Downloads for “${title}” were restored (${e.max_downloads} available again).`);
        await audit('support.restore_downloads', 'ticket', t.id, { ref, entitlement: a.entitlementId });
        break;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/support]', a.action, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Action failed' }, { status: 400 });
  }
}
