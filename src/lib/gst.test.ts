import { describe, expect, it } from 'vitest';
import { gstTreatment } from './gst';

const base = { registered: true, lutFiled: false, currency: 'INR', sellerGstin: '24ABCDE1234F1Z5', buyerGstin: null };
describe('gstTreatment', () => {
  it('unregistered sellers issue plain receipts', () => {
    expect(gstTreatment({ ...base, registered: false }).mode).toBe('none');
  });
  it('domestic: CGST+SGST same state or no buyer GSTIN, IGST across states', () => {
    expect(gstTreatment(base).mode).toBe('cgst_sgst');
    expect(gstTreatment({ ...base, buyerGstin: '24XYZAB1234C1Z9' }).mode).toBe('cgst_sgst');
    expect(gstTreatment({ ...base, buyerGstin: '27XYZAB1234C1Z9' }).mode).toBe('igst');
  });
  it('exports: zero-rated under LUT, IGST otherwise', () => {
    expect(gstTreatment({ ...base, currency: 'USD', lutFiled: true }).mode).toBe('export_lut');
    expect(gstTreatment({ ...base, currency: 'USD' }).mode).toBe('igst');
  });
});
