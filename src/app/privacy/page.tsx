import type { Metadata } from 'next';
import { LegalNotice } from '@/components/legal-notice';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <main className="container max-w-3xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <LegalNotice />
      <section className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          We process the minimum data needed to run the service: your account email, purchase and
          download history, and anonymised analytics events. Payment details are handled by our
          payment provider; we do not store card numbers.
        </p>
        <p>
          Download logs include a hashed IP for abuse prevention and forensic watermarking. We
          honour access/erasure requests under UK GDPR and India&apos;s DPDP Act, subject to legal
          retention obligations.
        </p>
        <p>Cookie consent and a full data-processing register are to be finalised with counsel.</p>
      </section>
    </main>
  );
}
