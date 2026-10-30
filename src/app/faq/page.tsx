import type { Metadata } from 'next';
import { FaqAccordion, type Faq } from '@/components/faq-accordion';

export const metadata: Metadata = { title: 'Help Centre / FAQ' };

const FAQS: (Faq & { topic: string })[] = [
  { topic: 'Purchases & Downloads', q: 'How do I download my wallpaper?', a: 'After purchase, open My Library and pick a size. Free wallpapers download straight from their page. Each download uses a secure link that expires after 60 seconds.' },
  { topic: 'Purchases & Downloads', q: 'Which sizes do I get?', a: 'One purchase includes every size we make for that wallpaper — the product page lists them. Portrait artworks come in phone and tablet sizes; landscape artworks in desktop 4K and 5K (plus ultrawide for very wide art). Files are high-quality JPG.' },
  { topic: 'Purchases & Downloads', q: 'How many times can I download?', a: 'Up to 5 downloads per purchase, across your devices. Free wallpapers need no account but are rate-limited.' },
  { topic: 'Payments', q: 'How do I pay?', a: 'In India you pay per wallpaper in rupees via Razorpay (UPI, cards, netbanking). Outside India you buy a credit pack by card and spend credits on wallpapers. Prices follow your billing country.' },
  { topic: 'Payments', q: 'Do credits expire?', a: 'No. Credits stay in your account and show under Account → Credits.' },
  { topic: 'Payments', q: 'Can I get a GST invoice?', a: 'Yes. Add your GSTIN under Account → Settings before buying; every paid order has a printable receipt under Account → Orders.' },
  { topic: 'Licensing', q: 'Can I use wallpapers commercially?', a: 'The standard licence is personal use. A commercial licence can be added from each product page for use in products, ads and client work.' },
  { topic: 'Licensing', q: 'Why is there a watermark on the preview?', a: 'Previews are small and visibly watermarked to protect the artwork. Your download is the full-quality file with only an invisible per-buyer mark.' },
  { topic: 'Refunds', q: 'What is your refund policy?', a: 'Digital goods are generally non-refundable once downloaded, but if a file is faulty or you were charged in error, contact us and we’ll make it right.' },
  { topic: 'Account', q: 'How do I sign in?', a: 'Enter your email on the sign-in page and click the link we send you — no password needed.' },
];

export default function FaqPage() {
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
