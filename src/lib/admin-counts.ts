import 'server-only';

import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/service';
import type { NavCounts } from '@/components/admin/admin-nav';

/** "Needs attention" numbers for the admin sidebar badges and dashboard. */
export const getAdminCounts = cache(async (): Promise<NavCounts & { _takedowns: number; _messages: number; _submissions: number; _kyc: number; _review: number; _support: number; _supportOverdue: number }> => {
  try {
    const s = createServiceClient();
    const head = { count: 'exact' as const, head: true };
    const now = new Date().toISOString();
    const [messages, takedowns, submissions, review, kyc, support, overdue] = await Promise.all([
      s.from('contact_messages').select('id', head).eq('status', 'new'),
      s.from('takedown_reports').select('id', head).in('status', ['open', 'reviewing']),
      s.from('wallpapers').select('id', head).eq('status', 'pending_review'),
      s.from('generation_jobs').select('id', head).eq('status', 'awaiting_review'),
      s.from('creators').select('user_id', head).eq('kyc_status', 'pending'),
      s.from('support_tickets').select('id', head).eq('status', 'open'),
      s
        .from('support_tickets')
        .select('id', head)
        .in('status', ['open', 'waiting_customer'])
        .or(`resolve_due_at.lt.${now},and(first_response_at.is.null,ack_due_at.lt.${now})`),
    ]);
    const m = messages.count ?? 0;
    const t = takedowns.count ?? 0;
    return {
      '/admin/messages': m + t,
      '/admin/catalogue': submissions.count ?? 0,
      '/admin/review-queue': review.count ?? 0,
      '/admin/creators': kyc.count ?? 0,
      '/admin/support': support.count ?? 0,
      _messages: m,
      _takedowns: t,
      _submissions: submissions.count ?? 0,
      _review: review.count ?? 0,
      _kyc: kyc.count ?? 0,
      _support: support.count ?? 0,
      _supportOverdue: overdue.count ?? 0,
    };
  } catch {
    return { _messages: 0, _takedowns: 0, _submissions: 0, _review: 0, _kyc: 0, _support: 0, _supportOverdue: 0 };
  }
});
