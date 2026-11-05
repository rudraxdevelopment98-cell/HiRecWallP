import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { mail as baseMail, quote, safeSend } from '@/lib/mail-template';
import { publicEnv } from '@/lib/env';
import { escapeHtml } from '@/lib/gift-rules';
import { getSettings } from '@/lib/settings';
import { CATEGORY_LABEL, priorityFor, ticketRef, type TicketCategory, type TicketStatus } from '@/lib/support-rules';

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const brand = () => publicEnv.NEXT_PUBLIC_BRAND_NAME;

export interface Ticket {
  id: string;
  number: number;
  user_id: string;
  order_id: string | null;
  wallpaper_id: string | null;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  priority: 'normal' | 'high';
  assigned_to: string | null;
  ack_due_at: string;
  resolve_due_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  last_message_at: string;
  last_customer_message_at: string | null;
  customer_unread: boolean;
  created_at: string;
}

export interface TicketMessage {
  id: string;
  author_role: 'customer' | 'staff' | 'system';
  author_id: string | null;
  body: string;
  internal: boolean;
  created_at: string;
}

export const TICKET_FIELDS =
  'id, number, user_id, order_id, wallpaper_id, category, subject, status, priority, assigned_to, ack_due_at, resolve_due_at, first_response_at, resolved_at, resolution, last_message_at, last_customer_message_at, customer_unread, created_at';

// --- Email ------------------------------------------------------------------

const SUPPORT_FOOTER = () => `${brand()} support · please reply from the link above so your message stays with the request.`;
const mail = (title: string, paragraphs: string[], cta?: { href: string; label: string }) => baseMail(title, paragraphs, cta, SUPPORT_FOOTER());

async function customerEmail(userId: string): Promise<string | null> {
  const { data } = await createServiceClient().from('profiles').select('email').eq('id', userId).maybeSingle();
  return (data?.email as string | null) ?? null;
}

/** Where new-ticket alerts go: support email, else the grievance email. */
async function staffInbox(): Promise<string | null> {
  const s = await getSettings();
  return s.business.support_email || s.legal.grievance_email || null;
}

// --- Customer side ------------------------------------------------------------

export interface NewTicket {
  userId: string;
  category: TicketCategory;
  subject: string;
  body: string;
  orderId?: string | null;
  wallpaperId?: string | null;
  /** Created already resolved (e.g. an instant self-serve refund). */
  resolved?: { resolution: string; systemNote: string };
}

export async function createTicket(t: NewTicket): Promise<Ticket> {
  const s = createServiceClient();
  // Only link orders the customer owns.
  let orderId: string | null = null;
  if (t.orderId) {
    const { data } = await s.from('orders').select('id').eq('id', t.orderId).eq('user_id', t.userId).maybeSingle();
    orderId = (data?.id as string | undefined) ?? null;
  }
  const now = new Date().toISOString();
  const { data: ticket, error } = await s
    .from('support_tickets')
    .insert({
      user_id: t.userId,
      order_id: orderId,
      wallpaper_id: t.wallpaperId ?? null,
      category: t.category,
      subject: t.subject,
      priority: priorityFor(t.category),
      ...(t.resolved ? { status: 'resolved', resolved_at: now, first_response_at: now, resolution: t.resolved.resolution } : {}),
    })
    .select(TICKET_FIELDS)
    .single<Ticket>();
  if (error || !ticket) throw error ?? new Error('ticket insert failed');

  const msgs: Record<string, unknown>[] = [{ ticket_id: ticket.id, author_id: t.userId, author_role: 'customer', body: t.body }];
  if (t.resolved) msgs.push({ ticket_id: ticket.id, author_role: 'system', body: t.resolved.systemNote });
  await s.from('support_messages').insert(msgs);

  const ref = ticketRef(ticket.number);
  const link = `${site()}/account/support/${ticket.id}`;
  const to = await customerEmail(t.userId);
  if (t.resolved) {
    await safeSend(to, `${ref}: ${t.resolved.resolution}`, mail(`Done — ${ref}`, [escapeHtml(t.resolved.systemNote)], { href: link, label: 'View request' }));
  } else {
    await safeSend(
      to,
      `We've got your request — ${ref}`,
      mail(`We've got your request (${ref})`, [
        `Thanks for getting in touch about <strong>${escapeHtml(CATEGORY_LABEL[t.category].toLowerCase())}</strong>. We reply within 48 hours and aim to resolve every request well within a month.`,
        quote(t.body),
      ], { href: link, label: 'View or add details' }),
    );
    await safeSend(
      await staffInbox(),
      `[${ref}] ${CATEGORY_LABEL[t.category]}: ${t.subject}`,
      mail(`New request ${ref}`, [`<strong>${escapeHtml(t.subject)}</strong> from ${escapeHtml(to ?? 'a customer')}`, quote(t.body)], {
        href: `${site()}/admin/support/${ticket.id}`,
        label: 'Open in admin',
      }),
    );
  }
  return ticket;
}

/** The signed-in customer's tickets (RLS limits to their own). */
export async function listMyTickets(): Promise<Ticket[]> {
  const { data } = await (await createClient()).from('support_tickets').select(TICKET_FIELDS).order('last_message_at', { ascending: false }).limit(100);
  return (data ?? []) as Ticket[];
}

/** One ticket + its public messages, for the signed-in customer (RLS hides internal notes). */
export async function getMyTicket(id: string): Promise<{ ticket: Ticket; messages: TicketMessage[] } | null> {
  const db = await createClient();
  const { data: ticket } = await db.from('support_tickets').select(TICKET_FIELDS).eq('id', id).maybeSingle<Ticket>();
  if (!ticket) return null;
  const { data: messages } = await db
    .from('support_messages')
    .select('id, author_role, author_id, body, internal, created_at')
    .eq('ticket_id', id)
    .eq('internal', false)
    .order('created_at');
  return { ticket, messages: (messages ?? []) as TicketMessage[] };
}

/** Mark staff replies as seen (service role: customers can't write tickets). */
export async function markSeenByCustomer(ticketId: string, userId: string) {
  await createServiceClient().from('support_tickets').update({ customer_unread: false }).eq('id', ticketId).eq('user_id', userId).eq('customer_unread', true);
}

export type ReplyResult = 'ok' | 'not_found' | 'closed';

export async function addCustomerReply(ticketId: string, userId: string, body: string): Promise<ReplyResult> {
  const s = createServiceClient();
  const { data: t } = await s.from('support_tickets').select(TICKET_FIELDS).eq('id', ticketId).eq('user_id', userId).maybeSingle<Ticket>();
  if (!t) return 'not_found';
  if (t.status === 'closed') return 'closed';
  const now = new Date().toISOString();
  await s.from('support_messages').insert({ ticket_id: t.id, author_id: userId, author_role: 'customer', body });
  // A reply reopens a resolved request; the 1-month clock keeps running from the start.
  await s
    .from('support_tickets')
    .update({ status: 'open', last_message_at: now, last_customer_message_at: now, customer_unread: false, ...(t.status === 'resolved' ? { resolved_at: null } : {}) })
    .eq('id', t.id);
  const ref = ticketRef(t.number);
  await safeSend(
    await staffInbox(),
    `[${ref}] Customer replied: ${t.subject}`,
    mail(`Customer replied on ${ref}`, [quote(body)], { href: `${site()}/admin/support/${t.id}`, label: 'Open in admin' }),
  );
  return 'ok';
}

// --- Staff side ---------------------------------------------------------------

export async function addStaffReply(input: {
  ticketId: string;
  staffId: string;
  body: string;
  internal: boolean;
  /** Status after the reply; defaults to waiting on the customer. */
  status?: TicketStatus;
}): Promise<Ticket | null> {
  const s = createServiceClient();
  const { data: t } = await s.from('support_tickets').select(TICKET_FIELDS).eq('id', input.ticketId).maybeSingle<Ticket>();
  if (!t) return null;
  const now = new Date().toISOString();
  await s.from('support_messages').insert({ ticket_id: t.id, author_id: input.staffId, author_role: 'staff', body: input.body, internal: input.internal });
  if (input.internal) {
    if (input.status && input.status !== t.status) await setTicketStatus(t.id, input.status);
    return t;
  }
  const status = input.status ?? 'waiting_customer';
  await s
    .from('support_tickets')
    .update({
      status,
      last_message_at: now,
      customer_unread: true,
      first_response_at: t.first_response_at ?? now,
      assigned_to: t.assigned_to ?? input.staffId,
      ...(status === 'resolved' || status === 'closed' ? { resolved_at: t.resolved_at ?? now } : { resolved_at: null }),
    })
    .eq('id', t.id);
  const ref = ticketRef(t.number);
  await safeSend(
    await customerEmail(t.user_id),
    `${status === 'resolved' ? 'Resolved' : 'New reply'} — ${ref}: ${t.subject}`,
    mail(status === 'resolved' ? `Your request ${ref} is resolved` : `We replied to ${ref}`, [quote(input.body), status === 'resolved' ? 'If anything is still wrong, just reply and the request reopens.' : ''], {
      href: `${site()}/account/support/${t.id}`,
      label: 'View and reply',
    }),
  );
  return t;
}

export async function setTicketStatus(ticketId: string, status: TicketStatus, resolution?: string) {
  const now = new Date().toISOString();
  await createServiceClient()
    .from('support_tickets')
    .update({
      status,
      ...(status === 'resolved' || status === 'closed' ? { resolved_at: now } : { resolved_at: null }),
      ...(resolution !== undefined ? { resolution } : {}),
    })
    .eq('id', ticketId);
}

/** A system line in the thread (actions taken), visible to the customer unless internal. */
export async function addSystemNote(ticketId: string, body: string, internal = false) {
  const s = createServiceClient();
  await s.from('support_messages').insert({ ticket_id: ticketId, author_role: 'system', body, internal });
  if (!internal) await s.from('support_tickets').update({ last_message_at: new Date().toISOString(), customer_unread: true }).eq('id', ticketId);
}
