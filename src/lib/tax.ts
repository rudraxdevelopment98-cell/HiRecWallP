/**
 * Indian tax rules used by the site (pure functions, unit-tested).
 * Sources and plain-language notes: docs/TAX_COMPLIANCE.md. All rates and
 * thresholds come from `site_settings.tax` so they can be updated without
 * code changes. ⚠️ Not professional advice — verify before filing.
 */

export interface TaxSettings {
  /** Registered under GST (GSTIN in Business details). */
  gst_registered: boolean;
  /** Letter of Undertaking filed for the current FY (exports without IGST). */
  lut_filed: boolean;
  /** Registration threshold for service suppliers, ₹ aggregate turnover per FY. */
  gst_threshold_inr: number;
  /** TDS on creators' sales through the platform (s.393 Table 8(v), ex-194-O). */
  tds_sales_pct: number;
  tds_sales_no_pan_pct: number;
  /** Individual/HUF creators with PAN below this FY sales are not deducted. */
  tds_sales_exempt_below_inr: number;
  /** TDS on affiliate commission (s.393 Table 1(ii), ex-194H). */
  tds_commission_pct: number;
  tds_commission_no_pan_pct: number;
  tds_commission_threshold_inr: number;
  /** Presumptive profit rate on digital receipts (s.58). */
  presumptive_digital_pct: number;
  /** Deductor TAN (needed before deducting TDS). */
  tan: string;
}

export const DEFAULT_TAX: TaxSettings = {
  gst_registered: false,
  lut_filed: false,
  gst_threshold_inr: 2_000_000,
  tds_sales_pct: 0.1,
  tds_sales_no_pan_pct: 5,
  tds_sales_exempt_below_inr: 500_000,
  tds_commission_pct: 2,
  tds_commission_no_pan_pct: 20,
  tds_commission_threshold_inr: 20_000,
  presumptive_digital_pct: 6,
  tan: '',
};

const IST = 330 * 60_000;

/** Indian financial year (1 Apr – 31 Mar, IST) containing `at`. */
export function fyRange(at: Date = new Date()): { label: string; start: Date; end: Date } {
  const ist = new Date(at.getTime() + IST);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  const start = new Date(Date.UTC(y, 3, 1) - IST);
  const end = new Date(Date.UTC(y + 1, 3, 1) - IST);
  return { label: `${y}-${String((y + 1) % 100).padStart(2, '0')}`, start, end };
}

export type ThresholdLevel = 'ok' | 'watch' | 'soon' | 'register';

/** Where aggregate turnover stands against the GST registration limit. */
export function gstThresholdStatus(turnoverInr: number, threshold: number): { level: ThresholdLevel; pct: number } {
  const pct = threshold > 0 ? (turnoverInr / threshold) * 100 : 0;
  const level: ThresholdLevel = pct >= 100 ? 'register' : pct >= 90 ? 'soon' : pct >= 75 ? 'watch' : 'ok';
  return { level, pct: Math.round(pct * 10) / 10 };
}

export interface CreatorTaxProfile {
  pan: string | null;
  tax_resident: 'IN' | 'foreign';
  entity_type: 'individual' | 'huf' | 'firm' | 'company';
}

export interface TdsInput {
  creator: CreatorTaxProfile;
  /** This payout's sales value (₹) and affiliate commission (₹). */
  grossSales: number;
  affiliate: number;
  /** Earlier payouts this FY (₹) and TDS already deducted on commission. */
  fySalesBefore: number;
  fyAffiliateBefore: number;
  fyCommissionTdsBefore: number;
}

export interface TdsResult {
  tdsSales: number;
  tdsCommission: number;
  note: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * TDS to deduct from a creator payout.
 * - Non-residents: not automated (different rules/DTAA) → 0 with a note.
 * - Sales: individual/HUF with PAN whose FY sales stay within the exemption
 *   pay nothing; otherwise the rate (higher without PAN) on this payout's sales.
 * - Commission: once FY commission crosses the threshold, deduct on the
 *   whole FY amount so far (catch-up), minus what was already deducted.
 */
export function computeTds(input: TdsInput, t: TaxSettings = DEFAULT_TAX): TdsResult {
  const { creator } = input;
  if (creator.tax_resident !== 'IN') {
    return { tdsSales: 0, tdsCommission: 0, note: 'Non-resident creator: TDS not automated — review before paying.' };
  }
  const hasPan = Boolean(creator.pan);
  const notes: string[] = [];

  let tdsSales = 0;
  const fySales = input.fySalesBefore + input.grossSales;
  const smallIndividual = hasPan && (creator.entity_type === 'individual' || creator.entity_type === 'huf') && fySales <= t.tds_sales_exempt_below_inr;
  if (input.grossSales > 0 && !smallIndividual) {
    tdsSales = r2((input.grossSales * (hasPan ? t.tds_sales_pct : t.tds_sales_no_pan_pct)) / 100);
    if (!hasPan) notes.push('No PAN: higher TDS rate applied.');
  }

  let tdsCommission = 0;
  const fyAffiliate = input.fyAffiliateBefore + input.affiliate;
  if (input.affiliate > 0 && fyAffiliate > t.tds_commission_threshold_inr) {
    const rate = hasPan ? t.tds_commission_pct : t.tds_commission_no_pan_pct;
    tdsCommission = Math.max(0, r2((fyAffiliate * rate) / 100 - input.fyCommissionTdsBefore));
  }

  return { tdsSales, tdsCommission, note: notes.length ? notes.join(' ') : null };
}

/** Presumed taxable profit under the simplified scheme (informational). */
export function presumptiveProfit(digitalReceiptsInr: number, t: TaxSettings = DEFAULT_TAX): number {
  return Math.round((digitalReceiptsInr * t.presumptive_digital_pct) / 100);
}

export interface Deadline {
  date: Date;
  title: string;
  detail: string;
}

/** Upcoming compliance dates (next ~6 months) for this business's setup. */
export function upcomingDeadlines(now: Date, t: TaxSettings, hasCreatorTds: boolean): Deadline[] {
  const out: Deadline[] = [];
  const ist = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - IST);
  const fy = fyRange(now);
  const fyEndYear = fy.end.getUTCFullYear();
  // Presumptive-scheme taxpayers pay advance tax in one instalment by 15 March.
  out.push({ date: ist(fyEndYear, 2, 15), title: 'Advance tax (presumptive scheme)', detail: `Pay the full advance tax for FY ${fy.label} by 15 March.` });
  out.push({ date: ist(fyEndYear, 6, 31), title: 'Income-tax return', detail: `File the return for FY ${fy.label} (non-audit due date 31 July).` });
  if (t.gst_registered) {
    out.push({ date: ist(fyEndYear, 2, 31), title: 'GST LUT for next year', detail: 'File the Letter of Undertaking on the GST portal so exports stay free of IGST.' });
    for (let k = 0; k < 6; k++) {
      const m = new Date(Date.UTC(new Date(now.getTime() + IST).getUTCFullYear(), new Date(now.getTime() + IST).getUTCMonth() + k + 1, 1));
      out.push({ date: ist(m.getUTCFullYear(), m.getUTCMonth(), 11), title: 'GSTR-1', detail: 'Sales return for last month.' });
      out.push({ date: ist(m.getUTCFullYear(), m.getUTCMonth(), 20), title: 'GSTR-3B', detail: 'Summary return + pay GST for last month.' });
    }
  }
  if (hasCreatorTds) {
    for (let k = 0; k < 6; k++) {
      const m = new Date(Date.UTC(new Date(now.getTime() + IST).getUTCFullYear(), new Date(now.getTime() + IST).getUTCMonth() + k + 1, 1));
      out.push({ date: ist(m.getUTCFullYear(), m.getUTCMonth(), 7), title: 'Deposit TDS', detail: 'Pay TDS deducted from creator payouts last month (challan).' });
    }
    for (const [y, mo, d] of [[fyEndYear - 1, 6, 31], [fyEndYear - 1, 9, 31], [fyEndYear, 0, 31], [fyEndYear, 4, 31]] as const) {
      out.push({ date: ist(y, mo, d), title: 'TDS return (Form 26Q)', detail: 'Quarterly statement of TDS on creator payouts.' });
    }
  }
  const horizon = now.getTime() + 190 * 86_400_000;
  return out.filter((d) => d.date.getTime() >= now.getTime() && d.date.getTime() <= horizon).sort((a, b) => a.date.getTime() - b.date.getTime());
}
