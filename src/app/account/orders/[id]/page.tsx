import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';
import { formatMoneyMinor } from '@/lib/format';
import { getMyOrder } from '@/lib/orders';
import { PrintButton } from '@/components/account/print-button';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Receipt' };

/**
 * Printable receipt / tax invoice. Seller details and GST rate come from env
 * (BUSINESS_LEGAL_NAME, BUSINESS_ADDRESS, BUSINESS_GSTIN, GST_RATE_PERCENT).
 * Prices are treated as GST-inclusive. ⚠️ Invoice format and tax treatment
 * (CGST/SGST vs IGST, exports of services) must be confirmed by a CA.
 */
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const [order, user] = await Promise.all([getMyOrder(params.id), getUser()]);
  if (!order || order.status !== 'paid') notFound();

  const seller = {
    name: process.env.BUSINESS_LEGAL_NAME || publicEnv.NEXT_PUBLIC_BRAND_NAME,
    address: process.env.BUSINESS_ADDRESS || '',
    gstin: process.env.BUSINESS_GSTIN || '',
  };
  const rate = Number(process.env.GST_RATE_PERCENT ?? 18);
  const showGst = Boolean(seller.gstin) && order.currency === 'INR';
  const taxable = showGst ? Math.round(order.amount_minor / (1 + rate / 100)) : order.amount_minor;
  const tax = order.amount_minor - taxable;
  const money = (minor: number) => formatMoneyMinor(minor, order.currency);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/account/orders" className="text-sm underline">
          ← All orders
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-2xl border bg-card p-8 text-sm print:border-0 print:p-0">
        <header className="flex flex-wrap justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-lg font-semibold">{seller.name}</p>
            {seller.address && <p className="whitespace-pre-line text-muted-foreground">{seller.address}</p>}
            {seller.gstin && <p className="text-muted-foreground">GSTIN: {seller.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{showGst ? 'Tax Invoice' : 'Receipt'}</p>
            <p className="text-muted-foreground">No. {order.invoice_no ?? order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-muted-foreground">
              {new Date(order.paid_at ?? order.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </p>
          </div>
        </header>

        <section className="border-b py-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
          <p className="font-medium">{user?.email}</p>
          {order.buyer_gstin && <p className="text-muted-foreground">GSTIN: {order.buyer_gstin}</p>}
          {order.billing_country && <p className="text-muted-foreground">Country: {order.billing_country}</p>}
        </section>

        <table className="w-full border-b">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-3 font-medium">Item</th>
              <th className="py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="py-3">
                  <p className="font-medium">{l.label}</p>
                  <p className="text-xs text-muted-foreground">{l.detail} · digital download</p>
                </td>
                <td className="py-3 text-right">
                  {l.amount != null && order.currency === 'INR' ? money(Math.round(l.amount * 100)) : order.lines.length === 1 ? money(order.amount_minor) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1">
          {showGst && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <dt>Taxable value</dt>
                <dd>{money(taxable)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>GST @ {rate}% (included)</dt>
                <dd>{money(tax)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total paid</dt>
            <dd>{money(order.amount_minor)}</dd>
          </div>
        </dl>

        <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
          Paid online via Razorpay. This is a computer-generated document.
          {!seller.gstin && ' Seller GST details will appear here once registered.'}
        </footer>
      </article>
    </div>
  );
}
