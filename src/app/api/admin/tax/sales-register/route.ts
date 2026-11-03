import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin';
import { getSettings } from '@/lib/settings';
import { salesForFy, toCsv } from '@/lib/tax-data';

export const runtime = 'nodejs';

/** Admin: sales register for a financial year (?fy=2026 = FY 2026-27) as CSV. */
export async function GET(request: Request) {
  const denied = await adminGuard(request, false);
  if (denied) return denied;
  const y = Number(new URL(request.url).searchParams.get('fy'));
  const at = Number.isInteger(y) && y > 2000 && y < 2100 ? new Date(Date.UTC(y, 6, 1)) : new Date();
  const settings = await getSettings();
  const s = await salesForFy(at, settings.fx_to_inr);
  const csv = toCsv(
    ['Invoice no', 'Date (IST)', 'Status', 'Type', 'Domestic/Export', 'Billing country', 'Buyer GSTIN', 'Currency', 'Amount', `INR value (rates ${settings.fx_meta.updated_at?.slice(0, 10) ?? 'manual'})`, 'Customer email', 'Order id'],
    s.rows.map((r) => [
      r.invoice_no,
      new Date(r.paid_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      r.status,
      r.kind,
      r.export ? 'Export' : 'Domestic',
      r.billing_country,
      r.buyer_gstin,
      r.currency,
      (r.amount_minor / 100).toFixed(2),
      r.inr == null ? '' : r.inr.toFixed(2),
      r.email,
      r.order_id,
    ]),
  );
  return new NextResponse(csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="sales-register-FY${s.fy.label}.csv"` },
  });
}
