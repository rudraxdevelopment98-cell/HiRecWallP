import type { Metadata } from 'next';
import { LegalDoc } from '@/components/legal/legal-doc';
import { getLegalContext } from '@/lib/legal';

export const metadata: Metadata = { title: 'Shipping & Delivery Policy' };
export const dynamic = 'force-dynamic';

export default async function DeliveryPage() {
  const c = await getLegalContext();
  return (
    <LegalDoc
      policy="delivery"
      intro={<p>{c.brand} sells digital products only. Nothing is shipped; everything is delivered online to your account, worldwide.</p>}
      sections={[
        {
          id: 'what',
          heading: 'What we deliver',
          body: (
            <ul>
              <li><strong>Credit packs</strong> — credits added to your account balance.</li>
              <li><strong>Memberships</strong> — a plan on your account with a monthly wallpaper allowance.</li>
              <li><strong>Wallpapers</strong> — high-resolution image files in every listed size, downloadable from My Library, plus an <strong>exact fit</strong> cropped to the resolution of a screen you choose (when the artwork is large enough).</li>
              <li><strong>Gifts</strong> — a redeemable code, emailed to the recipient and shown in your account.</li>
            </ul>
          ),
        },
        {
          id: 'when',
          heading: 'When it arrives',
          body: (
            <>
              <p>
                Delivery starts as soon as the payment provider confirms your payment — usually within a few seconds. In rare cases (bank or UPI
                delays) confirmation can take up to 24 hours. You will see the credits, plan or gift on the confirmation page and in your account.
              </p>
              <p>Wallpapers you add with credits or a membership are in your library immediately.</p>
            </>
          ),
        },
        {
          id: 'downloads',
          heading: 'Downloading',
          body: (
            <p>
              Each wallpaper includes {c.settings.downloads_per_purchase} downloads across your devices. For security, every download uses a
              private link that expires after 60 seconds — just press download again to get a fresh one. Files are full quality; each purchased
              file carries an invisible mark linked to your order. An exact-fit file counts as one of those downloads, like any other size.
            </p>
          ),
        },
        {
          id: 'problems',
          heading: 'If something doesn’t arrive',
          body: (
            <p>
              If your payment went through but nothing appears after 24 hours, or a download fails, email <strong>{c.email}</strong> with your
              order number. We fix it within 48 hours, or refund under the Refund &amp; Cancellation Policy.
            </p>
          ),
        },
        {
          id: 'cost',
          heading: 'Delivery charges',
          body: <p>None. Prices shown include delivery and applicable taxes.</p>,
        },
      ]}
    />
  );
}
