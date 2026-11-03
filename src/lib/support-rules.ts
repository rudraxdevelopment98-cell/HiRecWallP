/** Support ticket labels and SLA logic (pure; shared by customer + admin UI). */

export const TICKET_CATEGORIES = ['refund', 'download', 'wrong_charge', 'quality', 'account', 'other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = 'open' | 'waiting_customer' | 'resolved' | 'closed';

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  refund: 'Refund request',
  download: 'Download problem',
  wrong_charge: 'Wrong or double charge',
  quality: 'Quality or resolution issue',
  account: 'Account or credits',
  other: 'Something else',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  waiting_customer: 'Waiting for you',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** Staff-facing wording for the same statuses. */
export const STAFF_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  waiting_customer: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** Money problems jump the queue. */
export function priorityFor(category: TicketCategory): 'normal' | 'high' {
  return category === 'wrong_charge' || category === 'refund' ? 'high' : 'normal';
}

export const ticketRef = (n: number) => `HW-T${n}`;

export interface SlaFields {
  status: TicketStatus;
  ack_due_at: string;
  resolve_due_at: string;
  first_response_at: string | null;
}

export type SlaState = 'done' | 'ack_overdue' | 'resolve_overdue' | 'ack_due_soon' | 'resolve_due_soon' | 'ok';

const HOUR = 3_600_000;

/**
 * Where a ticket stands against the 48-hour acknowledgement and 1-month
 * resolution deadlines (Consumer Protection (E-Commerce) Rules 2020, r.4(5)).
 */
export function slaState(t: SlaFields, now: Date = new Date()): SlaState {
  if (t.status === 'resolved' || t.status === 'closed') return 'done';
  const n = now.getTime();
  const resolveDue = new Date(t.resolve_due_at).getTime();
  if (n > resolveDue) return 'resolve_overdue';
  if (!t.first_response_at) {
    const ackDue = new Date(t.ack_due_at).getTime();
    if (n > ackDue) return 'ack_overdue';
    if (ackDue - n < 12 * HOUR) return 'ack_due_soon';
  }
  if (resolveDue - n < 3 * 24 * HOUR) return 'resolve_due_soon';
  return 'ok';
}

export const SLA_LABEL: Record<SlaState, string> = {
  done: '',
  ack_overdue: 'Reply overdue (48 h)',
  resolve_overdue: 'Resolution overdue (30 days)',
  ack_due_soon: 'Reply due soon',
  resolve_due_soon: 'Resolution due soon',
  ok: '',
};

export const isOverdue = (s: SlaState) => s === 'ack_overdue' || s === 'resolve_overdue';
