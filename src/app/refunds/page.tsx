import type { Metadata } from 'next';
import { LegalNotice } from '@/components/legal-notice';

export const metadata: Metadata = { title: 'Refund Policy' };

export default function RefundsPage() {
  return (
    <main className="container max-w-3xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Refund Policy</h1>
      <LegalNotice />
      <section className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          Wallpapers are digital goods delivered instantly. As a rule, completed downloads are
          non-refundable once the secure link has been used.
        </p>
        <p>
          If a file is faulty, fails to download, or was charged in error, contact us and we will
          investigate and, where appropriate, refund or re-issue. Unused credits may be refundable
          at our discretion.
        </p>
        <p>Statutory consumer rights (UK/EU/India) apply and will be reflected here after review.</p>
      </section>
    </main>
  );
}
