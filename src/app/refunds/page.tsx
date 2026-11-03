import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { getLegalContext } from '@/lib/legal';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy' };
export const dynamic = 'force-dynamic';

export default async function RefundsPage() {
  const c = await getLegalContext();
  const dl = c.settings.downloads_per_purchase;
  return (
    <LegalDoc
      policy="refunds"
      intro={
        <p>
          Everything on {c.brand} is digital and delivered instantly, so refunds depend on whether you have used what you bought. These rules
          are the same for every customer and every country. Your rights under the Consumer Protection Act, 2019 are not affected.
        </p>
      }
      sections={[
        {
          id: 'summary',
          heading: 'At a glance',
          body: (
            <ul>
              <li><strong>Credit pack, none of its credits used:</strong> full refund if you ask within 14 days of purchase.</li>
              <li><strong>Pay-once membership, no wallpapers added yet:</strong> full refund within 7 days of purchase.</li>
              <li><strong>Gift you bought, not yet redeemed:</strong> full refund to you within 14 days; the gift code is cancelled.</li>
              <li><strong>Faulty file, wrong resolution, or not as described:</strong> replacement or refund for that item, at any time within 30 days.</li>
              <li><strong>Charged twice, or charged for an order that failed:</strong> full refund of the extra charge, always.</li>
              <li><strong>Autopay:</strong> cancel any time in Account → Membership; no further charges. The month already paid keeps running.</li>
            </ul>
          ),
        },
        {
          id: 'credits',
          heading: 'Credit packs',
          body: (
            <>
              <p>
                A credit pack can be refunded in full if you request it within 14 days and none of that pack&rsquo;s credits have been spent.
                Bonus credits that came with the pack are removed with the refund. Once any credit from the pack has been used to add a
                wallpaper, the pack can no longer be refunded — the wallpapers you added stay in your library.
              </p>
              <p>Credits have no cash value and can&rsquo;t be exchanged for money except through a refund under this policy.</p>
            </>
          ),
        },
        {
          id: 'plans',
          heading: 'Memberships and autopay',
          body: (
            <>
              <p>
                <strong>Pay once (1, 3, 6 or 12 months):</strong> refundable in full within 7 days if you haven&rsquo;t added any wallpapers with
                the plan. After that, or once you have used the plan, it is not refundable, and it does not renew.
              </p>
              <p>
                <strong>Autopay:</strong> you can cancel in one click from Account → Membership. Cancelling stops all future payments; you keep the
                benefits until the end of the month you have paid for. A monthly charge is refundable if you ask within 48 hours of it and
                haven&rsquo;t added any wallpapers in that month. Long-term autopay plans can be cancelled the same way at any time, without a fee.
              </p>
              <p>Unused monthly allowance does not carry over and is not refunded.</p>
            </>
          ),
        },
        {
          id: 'wallpapers',
          heading: 'Wallpapers you have added',
          body: (
            <p>
              Adding a wallpaper to your library (with credits, a membership or a gift) delivers it immediately, with {dl} downloads in every
              listed size. Because the file is delivered at that moment, it is not refundable — except when it is faulty, doesn&rsquo;t match its
              listing (for example a size or resolution that isn&rsquo;t provided), or you can&rsquo;t download it because of a problem on our side.
              In those cases we replace it, restore your downloads, or return the credits.
            </p>
          ),
        },
        {
          id: 'gifts',
          heading: 'Gifts',
          body: (
            <p>
              The buyer can get a full refund for a gift that hasn&rsquo;t been redeemed, within 14 days of purchase; the code stops working.
              Once redeemed, the credits belong to the person who redeemed them and the gift is treated like their own credit pack.
            </p>
          ),
        },
        {
          id: 'how',
          heading: 'How to ask for a refund',
          body: (
            <>
              <p>
                Write to <strong>{c.email}</strong> from the email on your account, with your order number (shown in Account → Orders and on your
                receipt). We acknowledge within 48 hours and decide within 7 days.
              </p>
              <p>
                Approved refunds go back to the original payment method (card, UPI or bank) through Razorpay. Banks usually show them within 5–7
                business days. If it takes longer, contact us and we will send the refund reference.
              </p>
            </>
          ),
        },
        {
          id: 'not-refundable',
          heading: 'When we can’t refund',
          body: (
            <ul>
              <li>Used credits, used plans, and wallpapers already added (unless faulty or not as described).</li>
              <li>Requests after the time limits above.</li>
              <li>Accounts closed for breaking the <Link href="/terms" className="underline">Terms</Link>, such as abusing regional prices or sharing paid files.</li>
              <li>Price differences: prices follow your location and account and are confirmed at checkout.</li>
            </ul>
          ),
        },
        {
          id: 'chargebacks',
          heading: 'Chargebacks and disputes',
          body: (
            <p>
              Please contact us before raising a dispute with your bank — we can usually fix things faster. If a payment is reversed by your
              bank, we remove what it bought (credits, plan or wallpapers). Unresolved complaints can go to our{' '}
              <Link href="/grievance" className="underline">Grievance Officer</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
