import { NextResponse } from 'next/server';
import { adminGuard, audit } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Admin: orders as CSV for accounting (?status=paid&from=YYYY-MM-DD&to=YYYY-MM-DD). */
export async function GET(request: Request) {
  const denied = await adminGuard(request, false);
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = createServiceClient()
    .from('orders')
    .select('id, invoice_no, created_at, paid_at, status, provider, currency, amount_minor, billing_country, buyer_gstin, profiles!orders_user_id_fkey(email), order_items(licence, wallpapers(title), credit_packs(credits), membership_plans(name))')
    .order('created_at', { ascending: true })
    .limit(50000);
  if (status && status !== 'all') query = query.eq('status', status);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lt('created_at', `${to}T23:59:59.999Z`);
  const { data } = await query;

  type Row = {
    id: string; invoice_no: string | null; created_at: string; paid_at: string | null; status: string; provider: string;
    currency: string; amount_minor: number; billing_country: string | null; buyer_gstin: string | null;
    profiles: { email: string | null } | null;
    order_items: { licence: string | null; wallpapers: { title: string } | null; credit_packs: { credits: number } | null; membership_plans: { name: string } | null }[];
  };
  const header = ['order_id', 'invoice_no', 'created_at', 'paid_at', 'status', 'provider', 'currency', 'amount', 'billing_country', 'buyer_gstin', 'email', 'items'];
  const lines = [header.join(',')];
  for (const o of (data ?? []) as unknown as Row[]) {
    const items = o.order_items
      .map((i) => (i.credit_packs ? `${i.credit_packs.credits} credits` : i.membership_plans ? `Pass: ${i.membership_plans.name}` : `${i.wallpapers?.title ?? 'Wallpaper'}${i.licence === 'commercial' ? ' (commercial)' : ''}`))
      .join('; ');
    lines.push(
      [o.id, o.invoice_no, o.created_at, o.paid_at, o.status, o.provider, o.currency, (o.amount_minor / 100).toFixed(2), o.billing_country, o.buyer_gstin, o.profiles?.email, items]
        .map(cell)
        .join(','),
    );
  }
  await audit('orders.export', 'orders', null, { status, from, to, rows: lines.length - 1 });
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
