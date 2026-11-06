import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { getLegalContext } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy' };
export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const c = await getLegalContext();
  return (
    <LegalDoc
      policy="privacy"
      intro={
        <p>
          This explains what personal data {c.legalName} (&ldquo;we&rdquo;) collects when you use {c.brand}, why, who processes it, how long we keep
          it and how you can control it. We follow India&rsquo;s Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025.
        </p>
      }
      sections={[
        {
          id: 'collect',
          heading: 'What we collect',
          body: (
            <ul>
              <li><strong>Account:</strong> email address, display name, optional country and GSTIN. If you use a password, our sign-in provider stores only a one-way hash of it; we never see it. When you choose a new password, your browser checks it against known data breaches by sending only the first 5 characters of its hash to Have I Been Pwned — never the password.</li>
              <li><strong>Purchases:</strong> what you bought, amount, currency, billing country, invoice details, payment reference. Card and UPI details stay with Razorpay; we never see or store them.</li>
              <li><strong>Usage:</strong> wallpapers you add, favourite and download (with a hashed — not raw — IP address), and anonymous page events.</li>
              <li><strong>Location signals:</strong> the country of your connection and your device time zone, to show the right prices.</li>
              <li><strong>Support:</strong> messages and requests you send us, and our replies.</li>
              <li><strong>Creators:</strong> payout details, PAN and tax residency for paying you and deducting tax.</li>
            </ul>
          ),
        },
        {
          id: 'why',
          heading: 'Why we use it',
          body: (
            <ul>
              <li>To run your account, deliver purchases, keep your library and process refunds.</li>
              <li>To price fairly for your country and stop pricing abuse and fraud.</li>
              <li>To keep invoices and tax records that the law requires.</li>
              <li>To send emails you asked for (receipts, gifts, and — only if you opt in — the daily wallpaper or newsletter).</li>
              <li>To improve the site using aggregated statistics.</li>
            </ul>
          ),
        },
        {
          id: 'processors',
          heading: 'Who processes it for us',
          body: (
            <ul>
              <li><strong>Supabase</strong> — database and sign-in (servers in Mumbai, India).</li>
              <li><strong>Vercel</strong> — website hosting (application servers in Mumbai; content delivery worldwide).</li>
              <li><strong>Razorpay</strong> — payments.</li>
              <li><strong>Resend</strong> — sending emails.</li>
              <li><strong>Cloudflare</strong> — file storage, if enabled.</li>
            </ul>
          ),
        },
        {
          id: 'cookies',
          heading: 'Cookies',
          body: (
            <ul>
              <li><strong>Sign-in</strong> — keeps you logged in.</li>
              <li><strong>country, region, tz</strong> — pricing for your location (30 days / 1 year).</li>
              <li><strong>ref, aff</strong> — remember a friend&rsquo;s invite or a creator&rsquo;s link for 30 days.</li>
              <li>Your cart and some favourites are kept in your browser&rsquo;s storage. We use no advertising or third-party tracking cookies.</li>
            </ul>
          ),
        },
        {
          id: 'retention',
          heading: 'How long we keep it',
          body: (
            <ul>
              <li>Account data: while your account is open; deleted within 30 days of closing it.</li>
              <li>Orders, invoices and tax records: 8 years, as tax law requires (kept even if you close your account).</li>
              <li>Download logs (hashed IP): 12 months. Raw page events: 30 days, then only daily totals.</li>
              <li>Support requests: 3 years after they are resolved (for follow-ups and disputes); requests about an order are kept with that order&rsquo;s records.</li>
            </ul>
          ),
        },
        {
          id: 'rights',
          heading: 'Your rights',
          body: (
            <>
              <p>
                You can ask to see your data, correct it, delete it, withdraw consent for optional emails, and nominate someone to act for you.
                In Account → Settings you can update your profile, change your email, sign out on all devices, <strong>download all your data</strong>{' '}
                as a file, and <strong>close your account</strong> (personal details are removed at once; order and invoice records are kept for 8
                years without your name or email, as tax law requires). Unsubscribe from any marketing email with one click. For anything else write to{' '}
                <strong>{c.grievance.email}</strong> — we reply within 48 hours and complete requests within 30 days.
              </p>
              <p>
                Complaints go to our <Link href="/grievance" className="underline">Grievance Officer</Link>; you may then approach the Data Protection
                Board of India.
              </p>
            </>
          ),
        },
        {
          id: 'children',
          heading: 'Children',
          body: <p>{c.brand} is for people aged 18 and over. We don&rsquo;t knowingly collect data from children; if you think we have, contact us and we will delete it.</p>,
        },
        {
          id: 'security',
          heading: 'Security',
          body: (
            <p>
              Data is encrypted in transit, payments are handled by a PCI-DSS-certified provider, and IP addresses are stored only as one-way hashes.
              Inside HirecWallp, staff see only what their role needs (for example, support sees orders, credits, sign-in times and support requests to
              help you), every staff action is recorded, and the admin area can require two-factor sign-in. If a breach affects you, we will tell you
              and the Data Protection Board as the law requires.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: 'Changes',
          body: <p>We will post changes here with a new version date, and email you about significant ones before they apply.</p>,
        },
      ]}
    />
  );
}
