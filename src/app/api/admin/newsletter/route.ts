import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Admin: newsletter subscribers as CSV (for Resend/Mailchimp import). */
export async function GET(request: Request) {
  const denied = await adminGuard(request, false);
  if (denied) return denied;
  const { data } = await createServiceClient()
    .from('newsletter_subscribers')
    .select('email, source, created_at')
    .order('created_at', { ascending: true });
  const lines = ['email,source,subscribed_at', ...(data ?? []).map((r) => [r.email, r.source ?? '', r.created_at].map((v) => csvCell(String(v))).join(','))];
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
