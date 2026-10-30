import type { Metadata } from 'next';
import { Clock, Mail } from 'lucide-react';
import { ContactForm } from '@/components/contact-form';

export const metadata: Metadata = { title: 'Contact us' };

export default function ContactPage() {
  return (
    <main className="container grid gap-10 py-12 lg:grid-cols-2">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Get in touch</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Have a question, licensing need, or feedback? We’d love to hear from you.
        </p>
        <div className="mt-8 space-y-5 text-sm">
          <Info icon={<Mail className="h-5 w-5" />} title="Email" value="support@hirecwallp.com" />
          <Info icon={<Clock className="h-5 w-5" />} title="Response time" value="Usually within 1–2 business days (IST)" />
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Copyright / takedown requests → use the{' '}
          <a href="/contact-takedown" className="underline">
            takedown form
          </a>
          .
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <ContactForm />
      </div>
    </main>
  );
}

function Info({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-secondary p-2.5 text-foreground">{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
