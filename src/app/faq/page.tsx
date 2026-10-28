import type { Metadata } from 'next';
import { FaqAccordion, type Faq } from '@/components/faq-accordion';

export const metadata: Metadata = { title: 'Help Centre / FAQ' };

const FAQS: Faq[] = [
  { q: 'How do I download my wallpaper?', a: 'After purchase (or for free wallpapers), open My Library and pick a resolution. We generate a secure, 60-second download link each time.' },
  { q: 'What file formats are available?', a: 'High-quality JPG up to 8K. Each variant is sized for phone, desktop, tablet and ultrawide screens.' },
  { q: 'Can I use wallpapers commercially?', a: 'The default licence is personal use. A commercial licence is available on each product page for use in products, ads and client work.' },
  { q: 'How many times can I download?', a: 'Up to 5 downloads per purchase by default, across your devices. Free wallpapers are rate-limited but need no account.' },
  { q: 'How do I cancel my membership?', a: 'Anytime from Account → Billing. You keep access until the end of the current period.' },
  { q: 'What is your refund policy?', a: 'Digital goods are generally non-refundable once downloaded, but if a file is faulty or charged in error, contact us and we’ll make it right.' },
];

export default function FaqPage() {
  return (
    <main className="container grid gap-8 py-12 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-sm font-semibold">Help topics</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {['Account', 'Purchases & Downloads', 'Payments', 'Refunds', 'Technical Issues', 'Licensing'].map((t) => (
            <li key={t} className="rounded-lg px-3 py-1.5 hover:bg-secondary hover:text-foreground">{t}</li>
          ))}
        </ul>
      </aside>
      <div>
        <h1 className="mb-1 font-display text-3xl font-semibold tracking-tight">Frequently Asked Questions</h1>
        <p className="mb-6 text-sm text-muted-foreground">Everything you need to know. Still stuck? Contact us.</p>
        <FaqAccordion items={FAQS} />
      </div>
    </main>
  );
}
