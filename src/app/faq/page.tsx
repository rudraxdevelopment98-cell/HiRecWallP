import type { Metadata } from 'next';
import { FaqAccordion, type Faq } from '@/components/faq-accordion';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Help Centre / FAQ' };

const ALL_FAQS: (Faq & { topic: string; member?: boolean })[] = [
  { topic: 'Purchases & Downloads', q: 'How do I download my wallpaper?', a: 'After purchase, open My Library and pick a size. Free wallpapers download straight from their page. Each download uses a secure link that expires after 60 seconds.' },
  { topic: 'Purchases & Downloads', q: 'Which sizes do I get?', a: 'One purchase includes every size we make for that wallpaper — the product page lists them. Portrait artworks come in phone and tablet sizes; landscape artworks in desktop 4K and 5K (plus ultrawide for very wide art). Files are high-quality JPG.' },
  { topic: 'Purchases & Downloads', q: 'How many times can I download?', a: 'Up to {downloads} downloads per purchase, across your devices. Free wallpapers need no account but are rate-limited.' },
  { topic: 'Payments', q: 'How do I pay?', a: 'Everything is bought with credits: 1 credit = 1 wallpaper in every size. Buy a credit pack (UPI, cards or netbanking in India; cards elsewhere) or a membership. Prices are set for your country and confirmed against your billing country at checkout.' },
  { topic: 'Payments', q: 'Why are prices different in my country?', a: 'We price credits and plans fairly for each country so wallpapers stay affordable everywhere. At checkout we use your billing country, and if it differs from where you are browsing we charge the higher of the two.' },
  { topic: 'Payments', q: 'Do credits expire?', a: 'Credits you pay for never expire. Bonus credits that come free with bigger packs last 12 months and are used first. See both under Account → Credits.' },
  { topic: 'Payments', q: 'Can I get a GST invoice?', a: 'Yes. Add your GSTIN under Account → Settings before buying; every paid order has a printable receipt under Account → Orders.' },
  { topic: 'Membership', q: 'How does membership work?', a: 'A membership gives you a fresh allowance of wallpapers every 30 days — like a data plan. Pick monthly, long-term (3, 6 or 12 months for less per month), a category pass, or Business (commercial licence). Unused allowance does not carry over, and wallpapers you add stay yours after the plan ends.', member: true },
  { topic: 'Membership', q: 'Does membership renew automatically?', a: 'Only if you choose Autopay. Pay-once plans never renew. Autopay charges the same amount each month and you can cancel any time in Account → Membership with one click — you keep the month you already paid for.', member: true },
  { topic: 'Payments', q: 'Can I choose which country’s prices I see?', a: 'No — like Netflix or Spotify, prices follow where you are and, after your first purchase, your account. That keeps prices fair for everyone. If you have moved country, contact us and we will update your account.' },
  { topic: 'Account', q: 'Do I get free credits?', a: 'Yes. Every new account gets free welcome credits to try a few wallpapers. Sign up with a friend’s invite link and you get extra. Welcome credits expire, so use them soon.' },
  { topic: 'Account', q: 'How does inviting friends work?', a: 'Share your link from Account → Invite friends. Your friend gets extra free credits when they join, and you get bonus credits when they make their first purchase.' },
  { topic: 'Licensing', q: 'Can I use wallpapers commercially?', a: 'The standard licence is personal use. A commercial licence can be added from each product page for use in products, ads and client work.' },
  { topic: 'Licensing', q: 'Why is there a watermark on the preview?', a: 'Previews are small and visibly watermarked to protect the artwork. Your download is the full-quality file with only an invisible per-buyer mark.' },
  { topic: 'Refunds', q: 'What is your refund policy?', a: 'Digital goods are generally non-refundable once downloaded, but if a file is faulty or you were charged in error, contact us and we’ll make it right.' },
  { topic: 'Account', q: 'How do I sign in?', a: 'Enter your email on the sign-in page and click the link we send you — no password needed.' },
];

export default async function FaqPage() {
  const settings = await getSettings();
  const FAQS = ALL_FAQS.filter((f) => settings.membership_enabled || !f.member).map((f) => ({
    ...f,
    a: f.a.replace('{downloads}', String(settings.downloads_per_purchase)),
  }));
  return (
    <main className="container grid gap-8 py-12 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-sm font-semibold">Help topics</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {[...new Set(FAQS.map((f) => f.topic))].map((t) => (
            <li key={t}>
              <a href={`#${t.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="block rounded-lg px-3 py-1.5 hover:bg-secondary hover:text-foreground">
                {t}
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <div>
        <h1 className="mb-1 font-display text-3xl font-semibold tracking-tight">Frequently Asked Questions</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Everything you need to know. Still stuck? <a href="/contact" className="underline">Contact us</a>.
        </p>
        <div className="space-y-8">
          {[...new Set(FAQS.map((f) => f.topic))].map((t) => (
            <section key={t} id={t.toLowerCase().replace(/[^a-z]+/g, '-')} className="scroll-mt-24">
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t}</h2>
              <FaqAccordion items={FAQS.filter((f) => f.topic === t)} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
