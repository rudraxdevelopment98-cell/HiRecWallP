import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings, sellerDetails } from '@/lib/settings';
import { formatRupees } from '@/lib/format';
import { fyRange, gstThresholdStatus, presumptiveProfit, upcomingDeadlines } from '@/lib/tax';
import { salesForFy } from '@/lib/tax-data';
import { AdminForm } from '@/components/admin/admin-form';
import { RunJobButton } from '@/components/admin/run-job-button';

export const dynamic = 'force-dynamic';

const LEVEL = {
  ok: { label: 'Not needed yet', cls: 'bg-emerald-500' },
  watch: { label: 'Getting close (75%)', cls: 'bg-amber-500' },
  soon: { label: 'Prepare now (90%)', cls: 'bg-orange-500' },
  register: { label: 'Register for GST now', cls: 'bg-rose-500' },
} as const;

export default async function AdminTaxPage() {
  await requireAdmin();
  const settings = await getSettings();
  const t = settings.tax;
  const now = new Date();
  const fy = fyRange(now);
  const [sales, { count: creatorCount }, { data: tdsRows }] = await Promise.all([
    salesForFy(now, settings.fx_to_inr),
    createServiceClient().from('creators').select('user_id', { count: 'exact', head: true }),
    createServiceClient().from('creator_payouts').select('tds_sales, tds_commission').eq('financial_year', fy.label),
  ]);
  const turnover = sales.domesticInr + sales.exportInr;
  const status = gstThresholdStatus(turnover, t.gst_threshold_inr);
  const tdsTotal = ((tdsRows ?? []) as { tds_sales: number; tds_commission: number }[]).reduce((n, r) => n + Number(r.tds_sales) + Number(r.tds_commission), 0);
  const seller = sellerDetails(settings, '');
  const hasCreators = (creatorCount ?? 0) > 0;
  const deadlines = upcomingDeadlines(now, t, hasCreators && tdsTotal > 0);
  const fyYear = fy.start.getUTCFullYear() + (fy.start.getUTCMonth() === 2 ? 1 : 0);

  const actions: string[] = [];
  if (status.level === 'register' && !t.gst_registered) actions.push('Your turnover has reached the GST limit: apply for GST registration within 30 days (gst.gov.in → Registration → New). Then enter the GSTIN in Settings → Business details and switch on "GST registered" below.');
  if ((status.level === 'soon' || status.level === 'watch') && !t.gst_registered) actions.push('Turnover is approaching the GST limit. Keep PAN, Aadhaar, bank proof and address proof ready to register.');
  if (t.gst_registered && !t.lut_filed && sales.exportInr > 0) actions.push('You sell abroad: file a Letter of Undertaking (LUT) on the GST portal so foreign sales stay free of IGST, then tick "LUT filed" below.');
  if (hasCreators && !t.tan) actions.push('Creators are on the platform. Before the first payout that needs TDS, get a TAN (Form 49B on the NSDL/Protean site, free) and enter it below.');
  if (!seller.address) actions.push('Add your address in Settings → Business details so receipts are complete.');
  if (sales.unconverted > 0) actions.push(`${sales.unconverted} foreign order(s) have no exchange rate — refresh rates below.`);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Tax centre</h1>
        <p className="text-sm text-muted-foreground">
          FY {fy.label} (1 April – 31 March). The site tracks your GST limit, creator TDS and key dates. ⚠️ Based on our reading of current rules
          (see docs/TAX_COMPLIANCE.md); verify on gst.gov.in / incometax.gov.in before filing.
        </p>
      </div>

      {actions.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="font-semibold">To do</p>
          <ul className="list-disc space-y-1 pl-5">
            {actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <p className="text-xs text-muted-foreground">Turnover this FY (India + exports, refunds excluded)</p>
          <p className="font-display text-3xl font-semibold">{formatRupees(turnover)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${status.pct}% of the GST limit`}>
            <div className={`h-full ${LEVEL[status.level].cls}`} style={{ width: `${Math.min(100, status.pct)}%` }} />
          </div>
          <p className="mt-2 text-sm">
            <strong>{status.pct}%</strong> of the {formatRupees(t.gst_threshold_inr)} GST registration limit · {t.gst_registered ? 'GST registered' : LEVEL[status.level].label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            India {formatRupees(sales.domesticInr)} · exports {formatRupees(sales.exportInr)} (converted at your current rates) · refunded {formatRupees(sales.refundedInr)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Income tax (simplified scheme, s.58)</p>
          <p className="font-display text-2xl font-semibold">{formatRupees(presumptiveProfit(turnover, t))}</p>
          <p className="text-xs text-muted-foreground">
            Presumed profit = {t.presumptive_digital_pct}% of digital receipts. Tax on it depends on your slab. All site payments are digital, so the 6% rate applies.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 text-sm">
          <h2 className="font-semibold">Upcoming dates</h2>
          {deadlines.length === 0 ? (
            <p className="mt-2 text-muted-foreground">Nothing due in the next six months.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {deadlines.slice(0, 10).map((d) => (
                <li key={`${d.title}-${d.date.toISOString()}`} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{d.title}</span>
                    <span className="block text-xs text-muted-foreground">{d.detail}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-sm">
          <h2 className="font-semibold">Registers (for your returns)</h2>
          <p className="text-muted-foreground">Download and keep these every month; they are what a filing service or the GST/TDS portals need.</p>
          <div className="flex flex-wrap gap-2">
            <a className="rounded-md border px-3 py-2 hover:bg-secondary" href={`/api/admin/tax/sales-register?fy=${fyYear}`}>Sales register FY {fy.label} (CSV)</a>
            <a className="rounded-md border px-3 py-2 hover:bg-secondary" href={`/api/admin/tax/tds-register?fy=${fyYear}`}>Creator TDS register (CSV)</a>
          </div>
          <p className="text-muted-foreground">TDS deducted this FY: <strong>{formatRupees(tdsTotal)}</strong></p>
          <div className="border-t pt-3">
            <p className="font-medium">Exchange rates</p>
            <p className="text-xs text-muted-foreground">
              {Object.entries(settings.fx_to_inr).map(([c, v]) => `${c} ₹${v}`).join(' · ')} — {settings.fx_meta.source}
              {settings.fx_meta.updated_at ? `, ${new Date(settings.fx_meta.updated_at).toLocaleDateString('en-IN')}` : ''}. Updated automatically on the 1st of each month.
            </p>
            <div className="mt-2">
              <RunJobButton label="Refresh rates now" endpoint="/api/jobs/fx-rates" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-1 font-semibold">Tax settings</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Defaults follow the Income-tax Act 2025 (from 1 Apr 2026) and CGST rules as we read them. Change only if the law changes. GSTIN and address live in{' '}
          <Link href="/admin/settings" className="underline">Settings → Business details</Link>.
        </p>
        <AdminForm
          action="/api/admin/settings"
          method="PUT"
          fields={[
            { name: 'gst_registered', label: 'GST registered', type: 'checkbox' },
            { name: 'lut_filed', label: 'LUT filed for this FY (exports without IGST)', type: 'checkbox', span: 3 },
            { name: 'gst_threshold_inr', label: 'GST registration limit (₹)', type: 'number' },
            { name: 'presumptive_digital_pct', label: 'Presumptive profit % (digital)', type: 'number' },
            { name: 'tan', label: 'TAN (for TDS)', placeholder: 'ABCD12345E', span: 2 },
            { name: 'tds_sales_pct', label: 'TDS on creator sales % (with PAN)', type: 'number' },
            { name: 'tds_sales_no_pan_pct', label: '… without PAN %', type: 'number' },
            { name: 'tds_sales_exempt_below_inr', label: 'Sales TDS exemption, individuals (₹/FY)', type: 'number', span: 2 },
            { name: 'tds_commission_pct', label: 'TDS on affiliate commission %', type: 'number' },
            { name: 'tds_commission_no_pan_pct', label: '… without PAN %', type: 'number' },
            { name: 'tds_commission_threshold_inr', label: 'Commission TDS threshold (₹/FY)', type: 'number', span: 2 },
          ]}
          initial={{ ...t }}
          submitLabel="Save tax settings"
          wrapAs="tax"
        />
      </section>
    </div>
  );
}
