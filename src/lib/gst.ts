/**
 * How GST shows on a receipt (pure; unit-tested). Prices are tax-inclusive.
 * - Not registered: plain receipt, no GST (below the ₹20 lakh service limit).
 * - Registered, sale in India: CGST+SGST when the buyer is in the seller's
 *   state — including consumers without an address on record, where the place
 *   of supply defaults to the supplier's location — or IGST for a business
 *   buyer in another state (state = first 2 digits of the GSTIN).
 * - Registered, foreign sale: export of services — zero-rated under LUT,
 *   otherwise IGST is charged (refundable).
 */
export type GstMode = 'none' | 'cgst_sgst' | 'igst' | 'export_lut';

export function gstTreatment(input: {
  registered: boolean;
  lutFiled: boolean;
  currency: string;
  sellerGstin: string | null | undefined;
  buyerGstin: string | null | undefined;
}): { mode: GstMode; title: string; note: string } {
  if (!input.registered) {
    return { mode: 'none', title: 'Receipt', note: 'Supplier not registered under GST; no GST charged.' };
  }
  if (input.currency !== 'INR') {
    return input.lutFiled
      ? { mode: 'export_lut', title: 'Tax Invoice (Export)', note: 'Supply meant for export under LUT without payment of IGST.' }
      : { mode: 'igst', title: 'Tax Invoice (Export)', note: 'Export of services with payment of IGST.' };
  }
  const sellerState = input.sellerGstin?.slice(0, 2);
  const buyerState = input.buyerGstin?.slice(0, 2);
  const interState = Boolean(buyerState && sellerState && buyerState !== sellerState);
  return { mode: interState ? 'igst' : 'cgst_sgst', title: 'Tax Invoice', note: interState ? 'Inter-state supply.' : 'Intra-state supply.' };
}
