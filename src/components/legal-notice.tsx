/** Banner marking legal copy as placeholder pending professional review. */
export function LegalNotice() {
  return (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
      <strong>Placeholder — not legal advice.</strong> This text is a draft and{' '}
      <strong>must be reviewed by a qualified lawyer/accountant</strong> (UK GDPR + India DPDP,
      GST/VAT, digital-goods refunds) before launch.
    </div>
  );
}
