import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { fyRange } from '@/lib/tax';
import { toCsv } from '@/lib/tax-data';

export const runtime = 'nodejs';

/** Admin: TDS deducted from creator payouts in a financial year, as CSV (for Form 26Q). */
export async function GET(request: Request) {
  const denied = await adminGuard(request, false);
  if (denied) return denied;
  const y = Number(new URL(request.url).searchParams.get('fy'));
  const fy = fyRange(Number.isInteger(y) && y > 2000 && y < 2100 ? new Date(Date.UTC(y, 6, 1)) : new Date());
  const { data } = await createServiceClient()
    .from('creator_payouts')
    .select('period, gross, commission, affiliate, tds_sales, tds_commission, net, status, tax_note, creators(display_name, pan, tax_resident, entity_type)')
    .eq('financial_year', fy.label)
    .order('period');
  type Row = {
    period: string; gross: number; commission: number; affiliate: number; tds_sales: number; tds_commission: number; net: number;
    status: string; tax_note: string | null; creators: { display_name: string | null; pan: string | null; tax_resident: string; entity_type: string } | null;
  };
  const csv = toCsv(
    ['Period', 'Creator', 'PAN', 'Resident', 'Entity', 'Sales value (₹)', 'Platform share (₹)', 'Affiliate commission (₹)', 'TDS on sales s.393 T8(v) (₹)', 'TDS on commission s.393 T1(ii) (₹)', 'Net paid (₹)', 'Payout status', 'Note'],
    ((data ?? []) as unknown as Row[]).map((r) => [
      r.period, r.creators?.display_name, r.creators?.pan, r.creators?.tax_resident, r.creators?.entity_type,
      r.gross, r.commission, r.affiliate, r.tds_sales, r.tds_commission, r.net, r.status, r.tax_note,
    ]),
  );
  return new NextResponse(csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="tds-register-FY${fy.label}.csv"` },
  });
}
