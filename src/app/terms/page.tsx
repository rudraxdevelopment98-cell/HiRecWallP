import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { getLegalContext } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms of Service' };
export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const c = await getLegalContext();
  return (
    <LegalDoc
      policy="terms"
      intro={
        <>
          <p>
            These terms are an agreement between you and {c.legalName}
            {c.address ? `, ${c.address.replace(/\n/g, ', ')}` : ''} (&ldquo;{c.brand}&rdquo;, &ldquo;we&rdquo;). By creating an account or buying
            anything you agree to them, together with the <Link href="/privacy" className="underline">Privacy Policy</Link>,{' '}
            <Link href="/refunds" className="underline">Refund &amp; Cancellation Policy</Link> and <Link href="/licence" className="underline">Licence</Link>.
          </p>
        </>
      }
      sections={[
        {
          id: 'account',
          heading: 'Your account',
          body: (
            <ul>
              <li>You must be 18 or older and give a working email address. One account per person.</li>
              <li>Keep access to your email secure — sign-in links and codes are sent there. You are responsible for activity on your account.</li>
              <li>Free welcome and invite credits are for genuine new customers; creating extra accounts to collect them is not allowed.</li>
            </ul>
          ),
        },
        {
          id: 'credits',
          heading: 'Credits',
          body: (
            <ul>
              <li>Credits are used only on {c.brand} to add wallpapers to your library. They are not money, have no cash value and can&rsquo;t be transferred, except by buying a gift.</li>
              <li>Credits you pay for never expire. Bonus credits (from packs, welcome or invite offers) expire on the date shown in Account → Credits and are used first.</li>
              <li>A wallpaper normally costs 1 credit; a commercial licence costs 5. The number of credits is shown before you confirm.</li>
            </ul>
          ),
        },
        {
          id: 'prices',
          heading: 'Prices and payment',
          body: (
            <ul>
              <li>Prices are set for your country and include applicable taxes. They follow the location of your connection and, after your first purchase, your account; at checkout the highest applicable price is used.</li>
              <li>Using VPNs, false billing details or other accounts to get another country&rsquo;s price is not allowed. We may charge the correct price, cancel the order or close the account.</li>
              <li>Payments are processed by Razorpay. Orders are confirmed only when the payment is verified.</li>
            </ul>
          ),
        },
        {
          id: 'plans',
          heading: 'Memberships and autopay',
          body: (
            <ul>
              <li>A membership gives a set number of wallpapers every 30 days for its term. Unused allowance does not carry over. Wallpapers you add stay yours after it ends.</li>
              <li>Pay-once plans never renew. Autopay charges the shown amount every month until you cancel or the agreed number of months ends; cancel any time in Account → Membership.</li>
              <li>Category passes cover only their category; Business plans include the commercial licence.</li>
            </ul>
          ),
        },
        {
          id: 'gifts',
          heading: 'Gifts and offers',
          body: (
            <ul>
              <li>Gift codes are valid for 12 months and can be redeemed once, in the same price region they were bought for or a cheaper one.</li>
              <li>Invite rewards, first-purchase bonuses, festival offers and the daily free wallpaper can change or end; offers already credited stay valid until their expiry date.</li>
            </ul>
          ),
        },
        {
          id: 'use',
          heading: 'Using the site fairly',
          body: (
            <p>
              Don&rsquo;t try to get around download limits, copy or scrape files, share paid files, misuse referral or affiliate links, or interfere
              with the site. We may suspend accounts that do, and remove what was obtained unfairly.
            </p>
          ),
        },
        {
          id: 'creators',
          heading: 'Creators',
          body: (
            <p>
              Creators who sell on {c.brand} also accept the creator agreement shown at sign-up: they must own the rights to their uploads, avoid
              trademarks, real people and adult content, and disclose AI generation. We deduct the platform commission and the tax the law requires
              before paying out each month.
            </p>
          ),
        },
        {
          id: 'content',
          heading: 'Content and complaints',
          body: (
            <p>
              All wallpapers are AI-generated and labelled as such. If you believe something infringes your rights, use{' '}
              <Link href="/contact-takedown" className="underline">Report content</Link>; we review reports promptly and remove infringing items.
            </p>
          ),
        },
        {
          id: 'liability',
          heading: 'Our responsibility',
          body: (
            <p>
              We work to keep the site available and files correct, and we fix or refund problems as the Refund Policy describes. To the extent the
              law allows, our total liability for any claim is limited to what you paid us in the 12 months before it. Nothing here limits rights you
              have under the Consumer Protection Act, 2019.
            </p>
          ),
        },
        {
          id: 'ending',
          heading: 'Closing your account',
          body: (
            <p>
              You can close your account at any time in Account → Settings (or by contacting us). Closing it ends your library, active passes
              and autopay, and any credits left are forfeited — unused packs can be refunded first as the Refund Policy allows. We may close
              accounts that break these terms; we will tell you why.
            </p>
          ),
        },
        {
          id: 'law',
          heading: 'Law and disputes',
          body: (
            <p>
              These terms are governed by the laws of India. Please contact us or our <Link href="/grievance" className="underline">Grievance Officer</Link>{' '}
              first; disputes that can&rsquo;t be resolved go to the courts{c.city ? ` at ${c.city}` : ' where our business is registered'}, without
              affecting your right to approach a consumer commission.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes to these terms',
          body: <p>We post changes here with a new version date and give at least 15 days&rsquo; notice by email for important changes before they apply.</p>,
        },
      ]}
    />
  );
}
