import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { toInr } from '@/lib/jobs/creator-payouts';
import { fyRange } from '@/lib/tax';

export interface SalesRow {
  order_id: string;
  invoice_no: string | null;
  paid_at: string;
  status: string;
  currency: string;
  amount_minor: number;
  billing_country: string | null;
  buyer_gstin: string | null;
  email: string | null;
  kind: string;
}

/** Orders in a financial year with INR values (foreign at the current rates). */
export async function salesForFy(fyLabelOrDate: Date, rates: Record<string, number>) {
  const fy = fyRange(fyLabelOrDate);
  const { data } = await createServiceClient().rpc('admin_sales_register', { p_from: fy.start.toISOString(), p_to: fy.end.toISOString() });
  const rows = ((data ?? []) as SalesRow[]).map((r) => ({
    ...r,
    inr: toInr(r.amount_minor, r.currency, rates),
    export: r.currency !== 'INR',
  }));
  const paid = rows.filter((r) => r.status === 'paid');
  const sum = (xs: typeof rows) => Math.round(xs.reduce((n, r) => n + (r.inr ?? 0), 0));
  return {
    fy,
    rows,
    domesticInr: sum(paid.filter((r) => !r.export)),
    exportInr: sum(paid.filter((r) => r.export)),
    refundedInr: sum(rows.filter((r) => r.status === 'refunded')),
    unconverted: paid.filter((r) => r.inr == null).length,
  };
}

/** CSV with proper quoting (Excel-safe: formula-looking cells are prefixed). */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
