import type { Metadata } from 'next';
import { LegalNotice } from '@/components/legal-notice';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <main className="container max-w-3xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <LegalNotice />
      <section className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          By using this site you agree to these terms. Content is provided for personal use under
          the licence granted at checkout. You must not attempt to circumvent download limits,
          scrape originals, or redistribute purchased files.
        </p>
        <p>
          All wallpapers are AI-generated and labelled as such. We make no warranty of copyright
          ownership in purely AI-generated imagery; your rights are governed by the licence
          (contract), not by a claim of copyright.
        </p>
        <p>
          The business entity is registered in India. Nothing here is legal or tax advice. Governing
          law and jurisdiction to be confirmed with counsel.
        </p>
      </section>
    </main>
  );
}
