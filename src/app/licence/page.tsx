import type { Metadata } from 'next';
import { LegalNotice } from '@/components/legal-notice';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Licence' };

export default function LicencePage() {
  const brand = publicEnv.NEXT_PUBLIC_BRAND_NAME;
  return (
    <main className="container max-w-3xl space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Licence</h1>
      <LegalNotice />
      <section className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          Each purchase grants a <strong>personal-use licence</strong> to the buyer for the
          wallpaper(s) bought. You may use the file on your own devices. You may not resell,
          redistribute, sublicense or use it commercially without a separate commercial licence.
        </p>
        <p>
          Wallpapers are AI-generated (and some are human-edited). Downloads carry a per-buyer
          forensic watermark and are traceable to the originating order. Sharing or leaking a
          purchased file breaches this licence.
        </p>
        <p>A commercial licence is offered as a separate, higher-priced SKU (Phase 2).</p>
        <p>© {new Date().getFullYear()} {brand}.</p>
      </section>
    </main>
  );
}
